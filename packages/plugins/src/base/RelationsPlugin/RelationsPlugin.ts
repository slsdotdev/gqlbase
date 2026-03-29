import { createPluginFactory, ITransformerContext, ITransformerPlugin } from "@gqlbase/core";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  FieldNode,
  InputValueNode,
  InterfaceNode,
  ListTypeNode,
  NamedTypeNode,
  ObjectNode,
  UnionNode,
} from "@gqlbase/core/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { pascalCase } from "@gqlbase/shared/format";
import {
  FieldRelationship,
  isPaginationConnection,
  isManyRelationship,
  isOneRelationship,
  isRelationField,
  isValidRelationTarget,
  parseFieldRelation,
  RelationDirective,
  RelationPluginOptions,
  RelationTarget,
} from "./RelationsPlugin.utils.js";
import { isListTypeNode } from "../ModelPlugin/ModelPlugin.utils.js";
import { isOperationNode } from "../TypesGeneratorBase/TypeGeneratorBase.utils.js";

/**
 * This plugin is responsible for adding the `@hasOne` and `@hasMany` directives to the schema, which can be used to define relationships between types.
 *
 * It also adds the necessary fields and arguments to the schema to support these directives.
 *
 * @definition
 * ```graphql
 * directive `@hasOne(key: String)` on FIELD_DEFINITION
 *
 * directive `@hasMany(key: String)` on FIELD_DEFINITION
 *
 * ```
 *
 * @example
 * ```graphql
 * # Before
 * type User {
 *   id: ID!
 *   name: String!
 *   posts: Post `@hasMany(key: "authorId")`
 * }
 *
 * type Post {
 *   id: ID!
 *   title: String!
 *   author: User `@hasOne`
 * }
 *
 * # After
 * type User {
 *   id: ID!
 *   name: String!
 *   posts: [Post] # formatted by the plugin
 * }
 *
 * type Post {
 *   id: ID!
 *   title: String!
 *   authorId: ID # added by the plugin
 *   author: User
 * }
 * ```
 */

export class RelationsPlugin implements ITransformerPlugin {
  readonly name = "RelationsPlugin";
  readonly context: ITransformerContext;
  private readonly options: Required<RelationPluginOptions>;

  constructor(context: ITransformerContext, options: RelationPluginOptions = {}) {
    this.context = context;
    this.options = {
      usePaginationTypes: options.usePaginationTypes ?? false,
    };
  }

  private _getRelationshipTarget(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): RelationTarget {
    const target = this.context.document.getNode(field.type.getTypeName());

    if (!target || !isValidRelationTarget(target)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${target?.name ?? "unknwon type"} is not a valid relationship target for ${object.name}.${field.name}`
      );
    }

    return target;
  }

  private _getFieldRelation(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): Required<FieldRelationship> | null {
    if (!isRelationField(field)) {
      return null;
    }

    const target = this._getRelationshipTarget(object, field);

    return parseFieldRelation(object, field, target);
  }

  private _setRelationKey(node: ObjectNode | InterfaceNode, key: string) {
    if (!node.hasField(key)) {
      node.addField(FieldNode.create(key, NamedTypeNode.create("ID")));
    }
  }

  private _setConnectionArguments(field: FieldNode) {
    if (!field.hasArgument("limit")) {
      field.addArgument(InputValueNode.create("limit", NamedTypeNode.create("Int")));
    }

    if (!field.hasArgument("nextToken")) {
      field.addArgument(InputValueNode.create("nextToken", NamedTypeNode.create("String")));
    }
  }

  private _createFieldConnection(field: FieldNode, target: ObjectNode | InterfaceNode | UnionNode) {
    this._setConnectionArguments(field);

    if (isPaginationConnection(target)) {
      return target;
    }

    const connectionTypeName = pascalCase(target.name, "Connection");

    return this.context.document.getOrCreateNode(
      connectionTypeName,
      ObjectNode.create(connectionTypeName)
        .addField(FieldNode.create("items", ListTypeNode.create(NamedTypeNode.create(target.name))))
        .addField(FieldNode.create("nextToken", NamedTypeNode.create("String")))
    );
  }

  public init() {
    this.context.base
      .addNode(
        DirectiveDefinitionNode.create(
          RelationDirective.HAS_ONE,
          ["FIELD_DEFINITION"],
          [InputValueNode.create("key", "String")]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          RelationDirective.HAS_MANY,
          ["FIELD_DEFINITION"],
          [InputValueNode.create("key", "String")]
        )
      );
  }

  public match(definition: DefinitionNode): boolean {
    if (definition instanceof InterfaceNode || definition instanceof ObjectNode) {
      if (definition.name === "Mutation") return false;
      if (isPaginationConnection(definition)) return false;
      if (!definition.fields?.length) return false;
      return true;
    }

    return false;
  }

  public normalize(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      const relation = this._getFieldRelation(definition, field);

      if (!relation) {
        continue;
      }

      if (relation.type === "oneToOne") {
        if (!isOperationNode(definition)) {
          this._setRelationKey(definition, relation.key);
        }

        continue;
      }

      if (relation.target instanceof UnionNode) {
        for (const type of relation.target.types ?? []) {
          const unionType = this.context.document.getNode(type.getTypeName());

          if (unionType instanceof ObjectNode || unionType instanceof InterfaceNode) {
            this._setRelationKey(unionType, relation.key);
            continue;
          }

          throw new TransformerPluginExecutionError(
            this.name,
            `Invalid relation union target: ${relation.target.name}`
          );
        }
      } else {
        this._setRelationKey(relation.target, relation.key);
      }
    }
  }

  execute(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      const relation = this._getFieldRelation(definition, field);

      if (!relation || relation.type === "oneToOne") {
        continue;
      }

      if (this.options.usePaginationTypes) {
        const connection = this._createFieldConnection(field, relation.target);
        field.setType(NamedTypeNode.create(connection.name));
        continue;
      }

      if (!isListTypeNode(field.type)) {
        field.setType(ListTypeNode.create(field.type));
      }
    }
  }

  public cleanup(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      if (isOneRelationship(field)) {
        field.removeDirective(RelationDirective.HAS_ONE);
      }

      if (isManyRelationship(field)) {
        field.removeDirective(RelationDirective.HAS_MANY);
      }
    }
  }

  after(): void {
    this.context.document
      .removeNode(RelationDirective.HAS_ONE)
      .removeNode(RelationDirective.HAS_MANY);
  }
}

export const relationPlugin = createPluginFactory(RelationsPlugin);
