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
  isEnumNode,
  isInputObjectNode,
  isListTypeNode,
  isScalarNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  TypeNode,
} from "../../definition/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { InternalDirective } from "../InternalUtilsPlugin/index.js";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { camelCase, pascalCase, pluralize } from "@gqlbase/shared/format";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import {
  DEFAULT_READ_OPERATIONS,
  DEFAULT_WRITE_OPERATIONS,
  isEmbedded,
  isModel,
  isPrimaryKeyField,
  ModelDirective,
  ModelOperation,
  OperationType,
  shouldSkipFieldFromCreateInput,
  shouldSkipFieldFromUpdateInput,
} from "./ModelPlugin.utils.js";
import { isClientOnly, isServerOnly } from "../UtilitiesPlugin/index.js";
import { isRelationField } from "../RelationsPlugin/index.js";
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

  // #region Mutation Inputs

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
      // Added before its fields, so an object type that refers back to itself reuses it.
      const input = InputObjectNode.create(inputName);
      this.context.document.addNode(input);

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

        // An unknown type is reported by the validation that runs after execute.
        if (!typeDef) {
          continue;
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
    }
  }

  // #endregion Mutation Inputs

  // #region Operations

  /**
   * The type `get` and `delete` take the id as: the model's own id type (`GUID`, `UUID`, …), `ID` when it declares none.
   */
  private _idTypeName(model: ObjectNode): string {
    return model.getField("id")?.type.getTypeName() ?? "ID";
  }

  private _createGetQueryField(model: ObjectNode) {
    const fieldName = camelCase("get", model.name);
    const queryNode = this.context.document.getQueryNode();

    if (!queryNode.hasField(fieldName)) {
      const field = FieldNode.create(
        fieldName,
        undefined,
        [DirectiveNode.create("hasOne")],
        NamedTypeNode.create(model.name),
        [InputValueNode.create("id", undefined, undefined, NonNullTypeNode.create(this._idTypeName(model)))]
      );

      queryNode.addField(field);
    }
  }

  /**
   * The `filter` argument comes from `FilterPlugin`, like on every `@hasMany` field.
   */
  private _createListQueryField(model: ObjectNode) {
    const fieldName = camelCase("list", pluralize(model.name));
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
            NonNullTypeNode.create(NamedTypeNode.create(this._idTypeName(model)))
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
      )
      .addNode(DirectiveDefinitionNode.create(ModelDirective.EMBEDDED, undefined, ["OBJECT"]));
  }

  /**
   * An `@embedded` type is a value: it is not a model, has no `id` and no relations, and does not contain itself, since its
   * members become columns of the model that uses it.
   */
  public before() {
    for (const definition of this.context.document.definitions.values()) {
      if (!isEmbedded(definition)) continue;

      if (definition.hasDirective(ModelDirective.MODEL)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Type ${definition.name} cannot be both @model and @embedded.`
        );
      }

      for (const field of definition.fields ?? []) {
        if (isPrimaryKeyField(field) || isRelationField(field)) {
          throw new TransformerPluginExecutionError(
            this.name,
            `Field ${definition.name}.${field.name} cannot be on an @embedded type, which has no id and no relations.`
          );
        }
      }

      this._checkEmbeddedCycle(definition, [definition.name]);
    }
  }

  private _checkEmbeddedCycle(definition: ObjectNode, path: string[]) {
    for (const field of definition.fields ?? []) {
      if (isListTypeNode(field.type)) continue;

      const member = this.context.document.getNode(field.type.getTypeName());

      if (!member || !isEmbedded(member)) continue;

      if (path.includes(member.name)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `@embedded type ${member.name} contains itself (${[...path, member.name].join(" > ")}).`
        );
      }

      this._checkEmbeddedCycle(member, [...path, member.name]);
    }
  }

  public match(definition: DefinitionNode) {
    return isModel(definition) || isEmbedded(definition);
  }

  public normalize(definition: ObjectNode) {
    if (!isModel(definition)) return;

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
    if (!isModel(definition)) return;

    const operations = this._getOperationNames(definition);

    for (const verb of operations) {
      switch (verb) {
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
  }

  public cleanup(definition: ObjectNode): void {
    definition.removeDirective(ModelDirective.MODEL).removeDirective(ModelDirective.EMBEDDED);
  }

  public after(): void {
    this.context.document
      .removeNode(ModelDirective.MODEL)
      .removeNode(ModelDirective.EMBEDDED)
      .removeNode("ModelOperation");
  }
}

export const modelPlugin = createPluginFactory(ModelPlugin);
