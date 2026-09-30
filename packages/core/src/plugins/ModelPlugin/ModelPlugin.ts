import { type ITransformerPlugin } from "../ITransformerPlugin.js";
import type { ITransformerContext } from "../../context/index.js";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  EnumNode,
  FieldNode,
  InputObjectNode,
  InputValueNode,
  InterfaceNode,
  isEnumNode,
  isInputObjectNode,
  isListTypeNode,
  isObjectLike,
  isScalarNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  ScalarNode,
  TypeNode,
} from "../../definition/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { getTypeHint, InternalDirective } from "../InternalUtilsPlugin/index.js";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { camelCase, pascalCase, pluralize } from "@gqlbase/shared/format";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import {
  DEFAULT_READ_OPERATIONS,
  DEFAULT_WRITE_OPERATIONS,
  isModel,
  ModelDirective,
  ModelOperation,
  OperationType,
  shouldSkipFieldFromCreateInput,
  shouldSkipFieldFromFilterInput,
  shouldSkipFieldFromUpdateInput,
} from "./ModelPlugin.utils.js";
import { isManyRelationship } from "../RelationsPlugin/RelationsPlugin.utils.js";
import { isClientOnly, isServerOnly } from "../UtilitiesPlugin/index.js";
import { isSemanticNullable } from "../RfcFeaturesPlugin/RfcFeaturesPlugin.utils.js";

/**
 * `@model` directive plugin.
 *
 * Automatically generates query and mutation fields for types annotated with `@model` directive.
 * Supports customization of generated operations via directive arguments and plugin options.
 *
 * @important Depends on `RelationsPlugin` for handling relation fields, annotated with `@hasOne` and `@hasMany`.
 *
 * @example
 *
 * ```graphql
 * # Before
 *
 * type Post `@model` {
 *   id: ID!
 *   title: String!
 *   content: String
 * }
 *
 * # After
 *
 * type Post {
 *   id: ID!
 *   title: String!
 *   content: String
 * }
 *
 * input PostFilterInput {
 *   id: IDFilterInput
 *   title: StringFilterInput
 *   content: StringFilterInput
 *   and: [PostFilterInput]
 *   or: [PostFilterInput]
 *   not: PostFilterInput
 * }
 *
 * input CreatePostInput {
 *   id: ID
 *   title: String!
 *   content: String
 * }
 *
 * input UpdatePostInput {
 *   id: ID!
 *   title: String
 *   content: String
 * }
 *
 * type Query {
 *   getPost(id: ID!): Post `@hasOne`
 *   listPosts(filter: PostFilterInput): [Post] `@hasMany`
 * }
 *
 * type Mutation {
 *   createPost(input: CreatePostInput!): Post
 *   updatePost(input: UpdatePostInput!): Post
 *   deletePost(id: ID!): Post
 * }
 * ```
 */

export class ModelPlugin implements ITransformerPlugin {
  public readonly name = "ModelPlugin";
  readonly context: ITransformerContext;
  private _defaultOperations: OperationType[];

  constructor(context: ITransformerContext) {
    this.context = context;

    this._defaultOperations = this._expandOperations(context.options.operations);
  }

  private _expandOperations(operations: OperationType[]) {
    const expandedOperations = new Set<OperationType>();

    for (const operation of operations) {
      if (operation === "read") {
        DEFAULT_READ_OPERATIONS.forEach((op) => expandedOperations.add(op));
      } else if (operation === "write") {
        DEFAULT_WRITE_OPERATIONS.forEach((op) => expandedOperations.add(op));
      } else {
        expandedOperations.add(operation);
      }
    }

    return Array.from(expandedOperations);
  }

  private _getOperationNames(object: ObjectNode) {
    const directive = object.getDirective("model");

    if (!directive) {
      throw new TransformerPluginExecutionError(
        this.name,
        `@model directive not found for type ${object.name}`
      );
    }

    // A server-only model is a table the API never exposes.
    if (isServerOnly(object)) {
      return [];
    }

    const args = directive.getArgumentsJSON<{ operations?: OperationType[] }>();

    const operations = args.operations
      ? this._expandOperations(
          args.operations
            .map((op) => ModelOperation[op as keyof typeof ModelOperation])
            .filter(Boolean) as OperationType[]
        )
      : this._defaultOperations;

    // A client-only model is not stored, so there is nothing to write.
    if (isClientOnly(object)) {
      return operations.filter((op) => op === "get" || op === "list");
    }

    return operations;
  }

  // #region Filter Inputs

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

        const typeDef = this.context.document.getNodeOrThrow(typeName);

        if (isObjectLike(typeDef)) {
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

  private _createInputValueNode(
    field: FieldNode,
    typeNode: TypeNode,
    forceNullable = false,
    level = 0
  ): TypeNode {
    if (typeNode instanceof NonNullTypeNode) {
      return this._createInputValueNode(field, typeNode.type, forceNullable, level);
    }

    if (typeNode instanceof ListTypeNode) {
      const valueTypeNode = ListTypeNode.create(
        this._createInputValueNode(field, typeNode.type, false, level + 1)
      );

      return forceNullable || isSemanticNullable(field, level)
        ? valueTypeNode
        : NonNullTypeNode.create(valueTypeNode);
    }

    const typeName = NamedTypeNode.create(typeNode.getTypeName());

    return forceNullable || isSemanticNullable(field, level)
      ? typeName
      : NonNullTypeNode.create(typeName);
  }

  private _isIdField(field: FieldNode) {
    return field.name === "id";
  }

  private _cloneTypeNode<T extends TypeNode>(typeNode: T, newName: string): T {
    if (typeNode instanceof NonNullTypeNode) {
      return NonNullTypeNode.create(this._cloneTypeNode(typeNode.type, newName)) as T;
    }

    if (typeNode instanceof ListTypeNode) {
      return ListTypeNode.create(this._cloneTypeNode(typeNode.type, newName)) as T;
    }

    return NamedTypeNode.create(newName) as T;
  }

  private _createMutationInput(
    model: ObjectNode,
    verb: "create" | "update" | "upsert",
    inputName: string,
    enforceNullable = false
  ) {
    const mutationInput = this.context.document.getNode(inputName);

    if (mutationInput && !isInputObjectNode(mutationInput)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${mutationInput} is not an input type`
      );
    }

    if (!mutationInput) {
      const input = InputObjectNode.create(inputName);

      for (const field of model.fields ?? []) {
        if (verb === "create" && shouldSkipFieldFromCreateInput(field)) {
          continue;
        }

        if (verb !== "create" && shouldSkipFieldFromUpdateInput(field)) {
          continue;
        }

        const fieldTypeName = field.type.getTypeName();

        if (this._isIdField(field)) {
          input.addField(
            InputValueNode.create(
              field.name,
              undefined,
              undefined,
              verb === "create"
                ? NamedTypeNode.create(fieldTypeName)
                : NonNullTypeNode.create(fieldTypeName)
            )
          );
          continue;
        }

        // Buildin scalars
        if (isBuildInScalar(fieldTypeName)) {
          input.addField(
            InputValueNode.create(
              field.name,
              undefined,
              undefined,
              this._createInputValueNode(field, field.type, enforceNullable)
            )
          );
          continue;
        }

        const typeDef = this.context.document.getNode(fieldTypeName);

        if (!typeDef) {
          throw new TransformerPluginExecutionError(this.name, `Unknown type ${fieldTypeName}`);
        }

        if (isScalarNode(typeDef) || isEnumNode(typeDef)) {
          input.addField(
            InputValueNode.create(
              field.name,
              undefined,
              undefined,
              this._createInputValueNode(field, field.type, enforceNullable)
            )
          );
          continue;
        }

        if (typeDef instanceof ObjectNode) {
          if (typeDef.hasDirective("model")) {
            continue;
          }

          const inputName = pascalCase(fieldTypeName, "input");

          if (!this.context.document.hasNode(inputName)) {
            this._createMutationInput(typeDef, verb, inputName, false);
          }

          input.addField(
            InputValueNode.create(
              field.name,
              undefined,
              undefined,
              this._createInputValueNode(
                field,
                this._cloneTypeNode(field.type, inputName),
                enforceNullable
              )
            )
          );
        }
      }

      this.context.document.addNode(input);
    }
  }

  // #endregion Filter Inputs

  // #region Operations

  private _createGetQueryField(model: ObjectNode) {
    const fieldName = camelCase("get", model.name);
    const queryNode = this.context.document.getQueryNode();

    if (!queryNode.hasField(fieldName)) {
      const field = FieldNode.create(
        fieldName,
        undefined,
        [DirectiveNode.create("hasOne")],
        NamedTypeNode.create(model.name),
        [InputValueNode.create("id", undefined, undefined, NonNullTypeNode.create("ID"))]
      );

      queryNode.addField(field);
    }
  }

  /**
   * TODO: Handle sort input
   */
  private _createListQueryField(model: ObjectNode) {
    const fieldName = camelCase("list", pluralize(model.name));
    const filterInputName = pascalCase(model.name, "filter", "input");
    const queryNode = this.context.document.getQueryNode();

    let field = queryNode.getField(fieldName);

    if (!field) {
      field = FieldNode.create(
        fieldName,
        undefined,
        [DirectiveNode.create("hasMany")],
        NamedTypeNode.create(model.name),
        null
      );

      queryNode.addField(field);
    }

    if (!field.hasArgument("filter")) {
      field.addArgument(
        InputValueNode.create("filter", undefined, undefined, NamedTypeNode.create(filterInputName))
      );
    }
  }

  private _createDeleteMutationField(model: ObjectNode) {
    const fieldName = camelCase("delete", model.name);
    const mutationNode = this.context.document.getMutationNode();

    if (!mutationNode.hasField(fieldName)) {
      const field = FieldNode.create(
        fieldName,
        undefined,
        undefined,
        NamedTypeNode.create(model.name),
        [
          InputValueNode.create(
            "id",
            undefined,
            undefined,
            NonNullTypeNode.create(NamedTypeNode.create("ID"))
          ),
        ]
      );

      mutationNode.addField(field);
    }
  }

  private _createMutationField(model: ObjectNode, verb: "create" | "update" | "upsert") {
    const fieldName = camelCase(verb, model.name);
    const inputName = pascalCase(verb, model.name, "input");
    const mutationNode = this.context.document.getMutationNode();

    if (!mutationNode.hasField(fieldName)) {
      const field = FieldNode.create(
        fieldName,
        undefined,
        undefined,
        NamedTypeNode.create(model.name),
        [
          InputValueNode.create(
            "input",
            undefined,
            undefined,
            NonNullTypeNode.create(NamedTypeNode.create(inputName))
          ),
        ]
      );

      mutationNode.addField(field);
    }
  }

  // #endregion Operations

  public init() {
    this.context.base
      .addNode(
        EnumNode.create(
          "ModelOperation",
          undefined,
          [DirectiveNode.create(InternalDirective.INTERNAL)],
          Object.keys(ModelOperation)
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          "model",
          undefined,
          ["OBJECT"],
          [
            InputValueNode.create(
              "operations",
              undefined,
              undefined,
              ListTypeNode.create(NonNullTypeNode.create("ModelOperation"))
            ),
          ]
        )
      );
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

  public match(definition: DefinitionNode) {
    return isModel(definition);
  }

  public normalize(definition: ObjectNode) {
    const operations = this._getOperationNames(definition);

    for (const verb of operations) {
      switch (verb) {
        case "get":
          this._createGetQueryField(definition);
          continue;
        case "list":
          this._createListQueryField(definition);
          continue;
        case "delete":
          this._createDeleteMutationField(definition);
          continue;
        case "create":
        case "upsert":
        case "update":
          this._createMutationField(definition, verb);
          continue;
        default:
          continue;
      }
    }
  }

  public execute(definition: ObjectNode) {
    const operations = this._getOperationNames(definition);

    for (const verb of operations) {
      switch (verb) {
        case "list":
          this._createFilterInput(definition);
          continue;
        case "create":
        case "upsert":
        case "update":
          this._createMutationInput(
            definition,
            verb,
            pascalCase(verb, definition.name, "input"),
            verb !== "create"
          );
          continue;
        default:
          continue;
      }
    }

    for (const field of definition.fields ?? []) {
      if (isManyRelationship(field) && !field.hasArgument("filter")) {
        const target = this.context.document.getNodeOrThrow(field.type.getTypeName()) as ObjectNode;
        this._createFilterInput(target);

        field.addArgument(
          InputValueNode.create(
            "filter",
            undefined,
            undefined,
            NamedTypeNode.create(pascalCase(target.name, "filter", "input"))
          )
        );
      }
    }
  }

  public cleanup(definition: ObjectNode): void {
    definition.removeDirective(ModelDirective.MODEL);
  }

  public after(): void {
    this.context.document.removeNode(ModelDirective.MODEL).removeNode("ModelOperation");
  }
}

export const modelPlugin = createPluginFactory(ModelPlugin);
