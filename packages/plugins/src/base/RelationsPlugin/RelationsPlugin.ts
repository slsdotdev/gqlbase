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
import { camelCase, pascalCase } from "@gqlbase/shared/format";
import {
  FieldRelationship,
  isConnectionNode,
  isManyRelationship,
  isOneRelationship,
  isRelationField,
  isValidRelationTarget,
  RelationDirective,
  RelationPluginOptions,
} from "./RelationsPlugin.utils.js";

/**
 *  This plugin is responsible for adding the `@hasOne` and `@hasMany` directives to the schema, which can be used to define relationships between types. It also adds the necessary fields and arguments to the schema to support these directives.
 *
 * @example
 *
 * ```graphql
 * type User {
 *   id: ID!
 *   name: String!
 *   posts: [Post] \@hasMany
 * }
 *
 * type Post {
 *   id: ID!
 *   title: String!
 *   author: User \@hasOne
 * }
 * ```
 *
 * In the above example, the `User` type has a `posts` field that is decorated with the `@hasMany` directive, indicating that a user can have many posts. The plugin will automatically add the necessary fields and arguments to support this relationship in the schema.
 *
 */

export class RelationsPlugin implements ITransformerPlugin {
  readonly name = "RelationsPlugin";
  readonly context: ITransformerContext;
  private readonly _useConnections: boolean;

  constructor(
    context: ITransformerContext,
    options: RelationPluginOptions = { useConnections: false }
  ) {
    this.context = context;
    this._useConnections = options.useConnections ?? false;
  }

  private _getRelationshipTarget(field: FieldNode) {
    const fieldType = this.context.document.getNode(field.type.getTypeName());

    if (isRelationField(field)) {
      return fieldType;
    }

    return undefined;
  }

  private _getFieldRelation(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): Required<FieldRelationship> | null {
    const target = this._getRelationshipTarget(field);
    if (!target) return null;

    if (!isValidRelationTarget(target)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${target.name} is not a valid relationship target for ${object.name}.${field.name}`
      );
    }

    let directive = field.getDirective(RelationDirective.HAS_ONE);

    if (directive) {
      if (field.hasDirective(RelationDirective.HAS_MANY)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Multiple relationship directives detected for ${object.name}.${field.name}`
        );
      }

      const args = directive.getArgumentsJSON<{ key: string }>();

      return {
        type: "oneToOne",
        target: target,
        key: args.key ?? camelCase(field.name, "id"),
      };
    }

    directive = field.getDirective(RelationDirective.HAS_MANY);

    if (directive) {
      const args = directive.getArgumentsJSON<{ key: string }>();

      return {
        type: "oneToMany",
        target: target,
        key: args.key ?? camelCase(object.name, "id"),
      };
    }

    throw new TransformerPluginExecutionError(
      this.name,
      `Could not find connection directive: ${field.name}`
    );
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

    if (isConnectionNode(target)) {
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
      if (isConnectionNode(definition)) return false;
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
        this._setRelationKey(definition, relation.key);
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

      if (this._useConnections) {
        const connection = this._createFieldConnection(field, relation.target);
        field.setType(NamedTypeNode.create(connection.name));
        continue;
      }

      if (!(field.type instanceof ListTypeNode)) {
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
