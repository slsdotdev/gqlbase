import { isBuildInScalar } from "@gqlbase/shared/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { pascalCase } from "@gqlbase/shared/format";
import { type ITransformerContext } from "../../context/index.js";
import {
  ArgumentNode,
  DefinitionNode,
  DirectiveNode,
  EnumNode,
  FieldNode,
  InputObjectNode,
  InputValueNode,
  InterfaceNode,
  isEnumNode,
  isInputObjectNode,
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
  ValueNode,
} from "../../definition/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { getTypeHint, InternalDirective } from "../InternalUtilsPlugin/index.js";
import { isManyRelationship } from "../RelationsPlugin/RelationsPlugin.utils.js";
import { isEmbedded } from "../ModelPlugin/ModelPlugin.utils.js";
import {
  DATE_SCALARS,
  FilterKind,
  FilterOperator,
  FilterOperators,
  shouldSkipFieldFromFilterInput,
  SORT_DIRECTION,
} from "./FilterPlugin.utils.js";

/**
 * Adds the `filter` and `orderBy` arguments to every `@hasMany` field, whatever its parent type, including the `list<Models>` queries, and creates the
 * filter inputs it references.
 *
 * - `<Type>FilterInput`: one entry per filterable field of the target, plus `and`, `or` and `not`.
 * - Shared per-scalar inputs (`StringFilterInput`, `IntFilterInput`, …), `<Enum>FilterInput` per enum, `<Type>ListFilterInput` per list.
 * - `<Type>FieldFilterInput` for object-like fields: `exists`, and `where: <Type>FilterInput` on the members.
 *
 * It also adds `orderBy: <Type>OrderByInput`, a `{ <field>: SortDirection }` map whose key order sets the sort priority. An `@embedded` field
 * orders by its members, through a nested `<Type>OrderByInput`.
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
 *   posts(filter: PostFilterInput, orderBy: PostOrderByInput): Post `@hasMany`
 * }
 * ```
 */
export class FilterPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("FilterPlugin", context);
  }

  private _createSortDirection() {
    return EnumNode.create(SORT_DIRECTION, undefined, undefined, ["asc", "desc"]);
  }

  /**
   * `<Type>OrderByInput`: one `SortDirection` entry per sortable field, a non-list scalar or enum the filter accepts, and a nested
   * `<Type>OrderByInput` per `@embedded` field. `null` when there is none. Clients list keys in priority order.
   */
  private _createOrderByInput(target: ObjectNode | InterfaceNode): InputObjectNode | null {
    const inputName = pascalCase(target.name, "order", "by", "input");
    const existing = this.context.document.getNode(inputName);

    if (existing) {
      if (!isInputObjectNode(existing)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Type ${inputName} is not an input type`
        );
      }

      return existing;
    }

    const input = InputObjectNode.create(inputName);

    for (const field of target.fields ?? []) {
      if (shouldSkipFieldFromFilterInput(field) || isListTypeNode(field.type)) {
        continue;
      }

      const typeName = field.type.getTypeName();
      const typeDef = this.context.document.getNode(typeName);

      if (
        isBuildInScalar(typeName) ||
        (typeDef && (isScalarNode(typeDef) || isEnumNode(typeDef)))
      ) {
        input.addField(
          InputValueNode.create(
            field.name,
            undefined,
            undefined,
            NamedTypeNode.create(SORT_DIRECTION)
          )
        );
        continue;
      }

      // An embedded group's members are columns, so it orders by them, through its own input.
      const nested = typeDef && isEmbedded(typeDef) ? this._createOrderByInput(typeDef) : null;

      if (nested) {
        input.addField(
          InputValueNode.create(field.name, undefined, undefined, NamedTypeNode.create(nested.name))
        );
      }
    }

    if (!input.fields?.length) {
      return null;
    }

    this.context.document.addNode(input);
    return input;
  }

  /**
   * `in`, `between` and a list's `contains` (every item given) take `[T!]`, `exists` takes `Boolean`, every other operator takes `T`.
   */
  private _createOperatorFilterInput(name: string, typeName: string, kind: FilterKind) {
    const input = InputObjectNode.create(name);

    for (const operator of FilterOperators[kind]) {
      let type: TypeNode = NamedTypeNode.create(typeName);

      if (
        operator === FilterOperator.IN ||
        operator === FilterOperator.BETWEEN ||
        (kind === "list" && operator === FilterOperator.CONTAINS)
      ) {
        type = ListTypeNode.create(NonNullTypeNode.create(typeName));
      }

      if (operator === FilterOperator.EXISTS) {
        type = NamedTypeNode.create("Boolean");
      }

      // `between` is `[low, high]`: a pair in the generated TS types and Zod schemas.
      const directives =
        operator === FilterOperator.BETWEEN
          ? [
              DirectiveNode.create(InternalDirective.TUPLE, [
                ArgumentNode.create("size", ValueNode.int(2)),
              ]),
            ]
          : undefined;

      input.addField(InputValueNode.create(operator, undefined, directives, type));
    }

    return input;
  }

  private _getScalarFilterKind(node: ScalarNode): FilterKind {
    if (DATE_SCALARS.includes(node.name)) {
      return "date";
    }

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

    if (!this.context.document.hasNode(SORT_DIRECTION)) {
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
      if (!isManyRelationship(field)) {
        continue;
      }

      const target = this.context.document.getNode(field.type.getTypeName());

      if (!target || !(isObjectNode(target) || isInterfaceNode(target))) {
        continue;
      }

      if (!field.hasArgument("filter")) {
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

      const orderByInput = field.hasArgument("orderBy") ? null : this._createOrderByInput(target);

      if (orderByInput) {
        field.addArgument(
          InputValueNode.create(
            "orderBy",
            undefined,
            undefined,
            NamedTypeNode.create(orderByInput.name)
          )
        );
      }
    }
  }
}

export const filterPlugin = createPluginFactory(FilterPlugin);
