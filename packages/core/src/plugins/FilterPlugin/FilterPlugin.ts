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
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  ScalarNode,
  TypeNode,
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
 * - Shared per-scalar inputs (`StringFilterInput`, `IntFilterInput`, …), and `<Enum>FilterInput` per enum.
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

  private _createFilterInput(target: ObjectNode | InterfaceNode): InputObjectNode {
    const filterInputName = pascalCase(target.name, "filter", "input");
    let filterInput = this.context.document.getNode(filterInputName);

    if (filterInput && !(filterInput instanceof InputObjectNode)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${filterInputName} is not an input type`
      );
    }

    if (!filterInput) {
      filterInput = InputObjectNode.create(filterInputName);

      for (const field of target.fields ?? []) {
        if (shouldSkipFieldFromFilterInput(field)) {
          continue;
        }

        const typeName = field.type.getTypeName();
        const typeDef = isBuildInScalar(typeName)
          ? ScalarNode.create(typeName)
          : this.context.document.getNode(typeName);

        // An unknown type is reported by the validation that runs after execute.
        if (!typeDef || !(isScalarNode(typeDef) || isEnumNode(typeDef))) {
          continue;
        }

        filterInput.addField(
          InputValueNode.create(
            field.name,
            undefined,
            undefined,
            NamedTypeNode.create(this._getValueFilterInputName(field, typeDef))
          )
        );
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

      this.context.document.addNode(filterInput);
    }

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
