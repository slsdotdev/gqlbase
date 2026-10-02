import { isBuildInScalar } from "@gqlbase/shared/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { pascalCase } from "@gqlbase/shared/format";
import { type ITransformerContext } from "../../context/index.js";
import {
  DefinitionNode,
  EnumNode,
  FieldNode,
  InputObjectNode,
  InputValueNode,
  InterfaceNode,
  isEnumNode,
  isInterfaceNode,
  isListTypeNode,
  isObjectNode,
  isScalarNode,
  isUnionNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  ScalarNode,
  TypeNode,
  UnionNode,
} from "../../definition/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { getTypeHint } from "../InternalUtilsPlugin/index.js";
import { isManyRelationship } from "../RelationsPlugin/RelationsPlugin.utils.js";
import {
  FilterKind,
  FilterOperator,
  FilterOperators,
  shouldSkipFieldFromFilterInput,
} from "./FilterPlugin.utils.js";

/**
 * Adds the `filter` argument to every `@hasMany` field, whatever its parent type, including the `list<Models>` queries, and creates the
 * filter inputs it references.
 *
 * - `<Type>FilterInput`: one entry per filterable field of the target, plus `and`, `or` and `not`.
 * - Shared per-scalar inputs (`StringFilterInput`, `IntFilterInput`, …), `<Enum>FilterInput` per enum, `<Type>ListFilterInput` per list.
 * - `<Type>FieldFilterInput` for object-like fields: `exists`, and `where: <Type>FilterInput` on the members.
 *
 * @example
 * ```graphql
 * # Before
 * type Viewer {
 *   posts: Post `@hasMany`
 * }
 *
 * # After
 * type Viewer {
 *   posts(filter: PostFilterInput): Post `@hasMany`
 * }
 * ```
 */
export class FilterPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("FilterPlugin", context);
  }

  private _createSortDirection() {
    const enumNode = EnumNode.create("SortDirection", undefined, undefined, ["ASC", "DESC"]);
    return enumNode;
  }

  /**
   * `in` and `between` take `[T!]`, `exists` takes `Boolean`, every other operator takes `T`.
   */
  private _createOperatorFilterInput(name: string, typeName: string, kind: FilterKind) {
    const input = InputObjectNode.create(name);

    for (const operator of FilterOperators[kind]) {
      let type: TypeNode = NamedTypeNode.create(typeName);

      if (operator === FilterOperator.IN || operator === FilterOperator.BETWEEN) {
        type = ListTypeNode.create(NonNullTypeNode.create(typeName));
      }

      if (operator === FilterOperator.EXISTS) {
        type = NamedTypeNode.create("Boolean");
      }

      input.addField(InputValueNode.create(operator, undefined, undefined, type));
    }

    return input;
  }

  private _getScalarFilterKind(node: ScalarNode): FilterKind {
    const hint = getTypeHint(node);

    switch (hint) {
      case "id":
      case "string":
      case "number":
      case "boolean":
        return hint;
      case "object":
        return "boolean";
      case "unknown":
      default: {
        this.context.logger.warn(
          `Unknown type for scalar ${node.name}. Defaulting to minimal, boolean like, filter input.`
        );
        return "boolean";
      }
    }
  }

  /**
   * The filter input for a scalar or enum: the shared `<Type>FilterInput`, or `<Type>ListFilterInput` for a list of them.
   */
  private _getValueFilterInputName(field: FieldNode, typeDef: ScalarNode | EnumNode): string {
    const isList = isListTypeNode(field.type);
    const inputName = isList
      ? pascalCase(typeDef.name, "list", "filter", "input")
      : pascalCase(typeDef.name, "filter", "input");

    if (!this.context.document.hasNode(inputName)) {
      const kind = isList
        ? "list"
        : isEnumNode(typeDef)
          ? "enum"
          : this._getScalarFilterKind(typeDef);
      this.context.document.addNode(this._createOperatorFilterInput(inputName, typeDef.name, kind));
    }

    return inputName;
  }

  /**
   * The filter input for one field, or `null` when the field cannot be filtered: a list of objects, or an unknown type (reported by the
   * validation that runs after execute).
   */
  private _getFieldFilterInputName(field: FieldNode): string | null {
    const typeName = field.type.getTypeName();
    const typeDef = isBuildInScalar(typeName)
      ? ScalarNode.create(typeName)
      : this.context.document.getNode(typeName);

    if (!typeDef) {
      return null;
    }

    if (isScalarNode(typeDef) || isEnumNode(typeDef)) {
      return this._getValueFilterInputName(field, typeDef);
    }

    if (isListTypeNode(field.type)) {
      return null;
    }

    if (isObjectNode(typeDef) || isInterfaceNode(typeDef) || isUnionNode(typeDef)) {
      return this._createFieldFilterInput(typeDef).name;
    }

    return null;
  }

  /**
   * `<Type>FieldFilterInput` for an object-like field: `exists` on the value itself, and `where` on its members. A union has no common
   * members, so it gets `exists` only.
   */
  private _createFieldFilterInput(typeDef: ObjectNode | InterfaceNode | UnionNode) {
    const inputName = pascalCase(typeDef.name, "field", "filter", "input");
    const existing = this.context.document.getNode(inputName);

    if (existing) {
      return existing;
    }

    const input = InputObjectNode.create(inputName, undefined, undefined, [
      InputValueNode.create(
        FilterOperator.EXISTS,
        undefined,
        undefined,
        NamedTypeNode.create("Boolean")
      ),
    ]);
    this.context.document.addNode(input);

    if (!isUnionNode(typeDef)) {
      const where = this._createFilterInput(typeDef);
      input.addField(
        InputValueNode.create("where", undefined, undefined, NamedTypeNode.create(where.name))
      );
    }

    return input;
  }

  private _createFilterInput(target: ObjectNode | InterfaceNode): InputObjectNode {
    const filterInputName = pascalCase(target.name, "filter", "input");
    let filterInput = this.context.document.getNode(filterInputName);

    if (filterInput && !(filterInput instanceof InputObjectNode)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${filterInputName} is not an input type`
      );
    }

    if (filterInput) {
      return filterInput;
    }

    // Added before its fields, so a type that refers back to itself reuses it.
    filterInput = InputObjectNode.create(filterInputName);
    this.context.document.addNode(filterInput);

    for (const field of target.fields ?? []) {
      if (shouldSkipFieldFromFilterInput(field)) {
        continue;
      }

      const inputName = this._getFieldFilterInputName(field);

      if (inputName) {
        filterInput.addField(
          InputValueNode.create(field.name, undefined, undefined, NamedTypeNode.create(inputName))
        );
      }
    }

    const self = NonNullTypeNode.create(filterInputName);
    filterInput.addField(
      InputValueNode.create("and", undefined, undefined, ListTypeNode.create(self))
    );
    filterInput.addField(
      InputValueNode.create("or", undefined, undefined, ListTypeNode.create(self))
    );
    filterInput.addField(
      InputValueNode.create("not", undefined, undefined, NamedTypeNode.create(filterInputName))
    );

    return filterInput;
  }

  public before() {
    const builtIns: [string, FilterKind][] = [
      ["ID", "id"],
      ["String", "string"],
      ["Int", "number"],
      ["Float", "number"],
      ["Boolean", "boolean"],
    ];

    for (const [typeName, kind] of builtIns) {
      const inputName = pascalCase(typeName, "filter", "input");

      if (!this.context.document.hasNode(inputName)) {
        this.context.document.addNode(this._createOperatorFilterInput(inputName, typeName, kind));
      }
    }

    if (!this.context.document.hasNode("SortDirection")) {
      this.context.document.addNode(this._createSortDirection());
    }
  }

  public match(definition: DefinitionNode): boolean {
    if (isObjectNode(definition) || isInterfaceNode(definition)) {
      return definition.name !== "Mutation";
    }

    return false;
  }

  public execute(definition: ObjectNode | InterfaceNode) {
    for (const field of definition.fields ?? []) {
      if (!isManyRelationship(field) || field.hasArgument("filter")) {
        continue;
      }

      const target = this.context.document.getNode(field.type.getTypeName());

      if (!target || !(isObjectNode(target) || isInterfaceNode(target))) {
        continue;
      }

      const filterInput = this._createFilterInput(target);

      field.addArgument(
        InputValueNode.create(
          "filter",
          undefined,
          undefined,
          NamedTypeNode.create(filterInput.name)
        )
      );
    }
  }
}

export const filterPlugin = createPluginFactory(FilterPlugin);
