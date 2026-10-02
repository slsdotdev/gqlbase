import { isBuildInScalar } from "@gqlbase/shared/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { pascalCase } from "@gqlbase/shared/format";
import { type ITransformerContext } from "../../context/index.js";
import {
  DefinitionNode,
  EnumNode,
  InputObjectNode,
  InputValueNode,
  InterfaceNode,
  isEnumNode,
  isInterfaceNode,
  isListTypeNode,
  isObjectLike,
  isObjectNode,
  isScalarNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  ScalarNode,
} from "../../definition/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { getTypeHint } from "../InternalUtilsPlugin/index.js";
import { isManyRelationship } from "../RelationsPlugin/RelationsPlugin.utils.js";
import { shouldSkipFieldFromFilterInput } from "./FilterPlugin.utils.js";

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

  private _createSizeFilterInput() {
    const input = InputObjectNode.create("SizeFilterInput", undefined, undefined, [
      InputValueNode.create("ne", undefined, undefined, NamedTypeNode.create("Int")),
      InputValueNode.create("eq", undefined, undefined, NamedTypeNode.create("Int")),
      InputValueNode.create("le", undefined, undefined, NamedTypeNode.create("Int")),
      InputValueNode.create("lt", undefined, undefined, NamedTypeNode.create("Int")),
      InputValueNode.create("ge", undefined, undefined, NamedTypeNode.create("Int")),
      InputValueNode.create("gt", undefined, undefined, NamedTypeNode.create("Int")),
      InputValueNode.create(
        "between",
        undefined,
        undefined,
        ListTypeNode.create(NonNullTypeNode.create("Int"))
      ),
    ]);

    return input;
  }

  private _createSortDirection() {
    const enumNode = EnumNode.create("SortDirection", undefined, undefined, ["ASC", "DESC"]);
    return enumNode;
  }

  private _createStringLikeFilterInput(name: string, typeName: string) {
    const input = InputObjectNode.create(name, undefined, undefined, [
      InputValueNode.create("ne", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("eq", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("le", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("lt", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("ge", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("gt", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create(
        "in",
        undefined,
        undefined,
        ListTypeNode.create(NonNullTypeNode.create(typeName))
      ),
      InputValueNode.create("contains", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("notContains", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create(
        "between",
        undefined,
        undefined,
        ListTypeNode.create(NonNullTypeNode.create(typeName))
      ),
      InputValueNode.create("beginsWith", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("exists", undefined, undefined, NamedTypeNode.create("Boolean")),
      InputValueNode.create("size", undefined, undefined, NamedTypeNode.create("SizeFilterInput")),
    ]);

    return input;
  }

  private _createNumberLikeFilterInput(name: string, typeName: string) {
    const input = InputObjectNode.create(name, undefined, undefined, [
      InputValueNode.create("ne", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("eq", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("le", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("lt", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("ge", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("gt", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create(
        "in",
        undefined,
        undefined,
        ListTypeNode.create(NonNullTypeNode.create(typeName))
      ),
      InputValueNode.create(
        "between",
        undefined,
        undefined,
        ListTypeNode.create(NonNullTypeNode.create(typeName))
      ),
      InputValueNode.create("exists", undefined, undefined, NamedTypeNode.create("Boolean")),
    ]);

    return input;
  }

  private _createBooleanLikeFilterInput(name: string, typeName: string) {
    const input = InputObjectNode.create(name, undefined, undefined, [
      InputValueNode.create("ne", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("eq", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("exists", undefined, undefined, NamedTypeNode.create("Boolean")),
    ]);

    return input;
  }

  private _createIDLikeFilterInput(name: string, typeName: string) {
    const input = InputObjectNode.create(name, undefined, undefined, [
      InputValueNode.create("ne", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("eq", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create(
        "in",
        undefined,
        undefined,
        ListTypeNode.create(NonNullTypeNode.create(typeName))
      ),
      InputValueNode.create("exists", undefined, undefined, NamedTypeNode.create("Boolean")),
    ]);

    return input;
  }

  private _createListLikeFilterInput(name: string, typeName: string) {
    const input = InputObjectNode.create(name, undefined, undefined, [
      InputValueNode.create("contains", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("notContains", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("size", undefined, undefined, NamedTypeNode.create("SizeFilterInput")),
    ]);

    return input;
  }

  private _createEnumLikeFilterInput(name: string, typeName: string) {
    const input = InputObjectNode.create(name, undefined, undefined, [
      InputValueNode.create("eq", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create("ne", undefined, undefined, NamedTypeNode.create(typeName)),
      InputValueNode.create(
        "in",
        undefined,
        undefined,
        ListTypeNode.create(NonNullTypeNode.create(typeName))
      ),
      InputValueNode.create("exists", undefined, undefined, NamedTypeNode.create("Boolean")),
    ]);

    return input;
  }

  private _createScalarFilterInput(node: ScalarNode, inputName: string) {
    const scalarType = getTypeHint(node);

    switch (scalarType) {
      case "id":
        return this._createIDLikeFilterInput(inputName, node.name);
      case "string":
        return this._createStringLikeFilterInput(inputName, node.name);
      case "number":
        return this._createNumberLikeFilterInput(inputName, node.name);
      case "boolean":
        return this._createBooleanLikeFilterInput(inputName, node.name);
      case "object":
        return this._createBooleanLikeFilterInput(inputName, node.name);
      case "unknown":
      default: {
        this.context.logger.warn(
          `Unknown type for scalar ${node.name}. Defaulting to minimal, bolean like, filter input.`
        );
        return this._createBooleanLikeFilterInput(inputName, node.name);
      }
    }
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
        const inputName = pascalCase(typeName, "filter", "input");

        if (isBuildInScalar(typeName)) {
          filterInput.addField(
            InputValueNode.create(field.name, undefined, undefined, NamedTypeNode.create(inputName))
          );
          continue;
        }

        if (this.context.document.hasNode(inputName)) {
          filterInput.addField(
            InputValueNode.create(field.name, undefined, undefined, NamedTypeNode.create(inputName))
          );
          continue;
        }

        const typeDef = this.context.document.getNode(typeName);

        // An unknown type is reported by the validation that runs after execute.
        if (!typeDef || isObjectLike(typeDef)) {
          continue;
        }

        if (isListTypeNode(field.type) && (isScalarNode(typeDef) || isEnumNode(typeDef))) {
          const listFilterInputName = pascalCase(typeDef.name, "list", "filter", "input");

          if (!this.context.document.hasNode(listFilterInputName)) {
            const listFilterInput = this._createListLikeFilterInput(listFilterInputName, typeName);
            this.context.document.addNode(listFilterInput);
          }

          filterInput.addField(
            InputValueNode.create(
              field.name,
              undefined,
              undefined,
              NamedTypeNode.create(listFilterInputName)
            )
          );

          continue;
        }

        if (isScalarNode(typeDef)) {
          const scalarFilterInput = this._createScalarFilterInput(typeDef, inputName);

          if (scalarFilterInput) {
            this.context.document.addNode(scalarFilterInput);
            filterInput.addField(
              InputValueNode.create(
                field.name,
                undefined,
                undefined,
                NamedTypeNode.create(inputName)
              )
            );
          }

          continue;
        }

        if (isEnumNode(typeDef)) {
          const enumFilterInput = this._createEnumLikeFilterInput(inputName, typeDef.name);
          this.context.document.addNode(enumFilterInput);

          filterInput.addField(
            InputValueNode.create(field.name, undefined, undefined, NamedTypeNode.create(inputName))
          );

          continue;
        }
      }

      filterInput.addField(
        InputValueNode.create("and", undefined, undefined, ListTypeNode.create(filterInputName))
      );
      filterInput.addField(
        InputValueNode.create("or", undefined, undefined, ListTypeNode.create(filterInputName))
      );
      filterInput.addField(
        InputValueNode.create("not", undefined, undefined, NamedTypeNode.create(filterInputName))
      );

      this.context.document.addNode(filterInput);
    }

    return filterInput;
  }

  public before() {
    if (!this.context.document.hasNode("IDFilterInput")) {
      this.context.document.addNode(this._createIDLikeFilterInput("IDFilterInput", "ID"));
    }

    if (!this.context.document.hasNode("StringFilterInput")) {
      this.context.document.addNode(
        this._createStringLikeFilterInput("StringFilterInput", "String")
      );
    }

    if (!this.context.document.hasNode("IntFilterInput")) {
      this.context.document.addNode(this._createNumberLikeFilterInput("IntFilterInput", "Int"));
    }

    if (!this.context.document.hasNode("FloatFilterInput")) {
      this.context.document.addNode(this._createNumberLikeFilterInput("FloatFilterInput", "Float"));
    }

    if (!this.context.document.hasNode("BooleanFilterInput")) {
      this.context.document.addNode(
        this._createBooleanLikeFilterInput("BooleanFilterInput", "Boolean")
      );
    }

    if (!this.context.document.hasNode("SizeFilterInput")) {
      this.context.document.addNode(this._createSizeFilterInput());
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
        InputValueNode.create("filter", undefined, undefined, NamedTypeNode.create(filterInput.name))
      );
    }
  }
}

export const filterPlugin = createPluginFactory(FilterPlugin);
