import { isBuildInScalar } from "@gqlbase/shared/definition";
import { createPluginFactory } from "../createPluginFactory.js";
import { type ITransformerContext } from "../../context/index.js";
import { type ITransformerPlugin } from "../ITransformerPlugin.js";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  FieldNode,
  InputValueNode,
  InterfaceNode,
  isInterfaceNode,
  isObjectNode,
  isUnionNode,
  ListTypeNode,
  NamedTypeNode,
  ObjectNode,
  UnionNode,
  isListTypeNode,
  isNullableTypeNode,
  DirectiveNode,
  NonNullTypeNode,
} from "../../definition/index.js";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import {
  FieldRelationship,
  isManyRelationship,
  isOneRelationship,
  isRelationField,
  isValidRelationTarget,
  parseFieldRelation,
  RelationDirective,
  RelationTarget,
  isBelongsToRelationship,
} from "./RelationsPlugin.utils.js";
import { isClientOnly, UtilityDirective } from "../UtilitiesPlugin/index.js";
import { isSemanticNullable } from "../RfcFeaturesPlugin/RfcFeaturesPlugin.utils.js";

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
 * # After (with the `relay` option off; with it on, `ConnectionPlugin` makes `posts` a connection)
 * type User {
 *   id: ID!
 *   name: String!
 *   posts: [Post!] # formatted by the plugin; `Post!` becomes `[Post!]!`
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
  constructor(context: ITransformerContext) {
    this.context = context;
  }

  private _getRelationshipTarget(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): RelationTarget | null {
    const target = this.context.document.getNode(field.type.getTypeName());

    const typeName = field.type.getTypeName();

    // Built-in scalars are not document nodes, but they are never a valid target.
    if (!target && isBuildInScalar(typeName)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${typeName} is not a valid relationship target for ${object.name}.${field.name}`
      );
    }

    // An unknown type is reported by the validation that runs after execute.
    if (!target) {
      return null;
    }

    if (!isValidRelationTarget(target)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${target.name} is not a valid relationship target for ${object.name}.${field.name}`
      );
    }

    return target;
  }

  private _getKeyTypeName(target: RelationTarget): string {
    if (isUnionNode(target)) {
      const idTypes = new Set<string>();

      for (const type of target.types ?? []) {
        const unionType = this.context.document.getNode(type.getTypeName());

        if (!unionType) continue;

        if (isObjectNode(unionType) || isInterfaceNode(unionType)) {
          const idField = unionType.getField("id");

          if (!idField) {
            throw new TransformerPluginExecutionError(
              this.name,
              `Union type ${target.name} has a member ${unionType.name} that does not have an id field. A key directive with an explicit type must be provided.`
            );
          }

          idTypes.add(idField.type.getTypeName());
          continue;
        }

        throw new TransformerPluginExecutionError(
          this.name,
          `Invalid relation union target: ${target.name}`
        );
      }

      if (idTypes.size > 1) {
        return "ID";
      }

      return Array.from(idTypes.values())[0];
    }

    const idField = target.getField("id");

    if (!idField) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Relation target ${target.name} does not have an id field. A key directive with an explicit type must be provided.`
      );
    }

    return idField.type.getTypeName();
  }

  private _getFieldRelation(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): FieldRelationship | null {
    if (!isRelationField(field)) {
      return null;
    }

    const target = this._getRelationshipTarget(object, field);
    return target ? parseFieldRelation(object, field, target) : null;
  }

  private _setRelationKey(
    node: ObjectNode | InterfaceNode | UnionNode,
    key: string,
    typeName = "ID",
    isNullable = false
  ) {
    if (isUnionNode(node)) {
      for (const type of node.types ?? []) {
        const unionType = this.context.document.getNode(type.getTypeName());

        if (!unionType) continue;

        if (isObjectNode(unionType) || isInterfaceNode(unionType)) {
          this._setRelationKey(unionType, key);
          continue;
        }

        throw new TransformerPluginExecutionError(
          this.name,
          `Invalid relation union target: ${node.name}`
        );
      }

      return;
    }

    if (!node.hasField(key)) {
      node.addField(
        FieldNode.create(
          key,
          undefined,
          [
            DirectiveNode.create(UtilityDirective.SERVER_ONLY),
            DirectiveNode.create(UtilityDirective.WRITE_ONLY),
          ],
          isNullable
            ? NamedTypeNode.create(typeName)
            : NonNullTypeNode.create(NamedTypeNode.create(typeName))
        )
      );
    }
  }

  public init() {
    this.context.base
      .addNode(
        DirectiveDefinitionNode.create(
          RelationDirective.HAS_ONE,
          undefined,
          ["FIELD_DEFINITION"],
          [InputValueNode.create("key", undefined, undefined, "String")]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          RelationDirective.BELONGS_TO,
          undefined,
          ["FIELD_DEFINITION"],
          [InputValueNode.create("key", undefined, undefined, "String")]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          RelationDirective.HAS_MANY,
          undefined,
          ["FIELD_DEFINITION"],
          [InputValueNode.create("key", undefined, undefined, "String")]
        )
      );
  }

  public match(definition: DefinitionNode): boolean {
    if (definition instanceof InterfaceNode || definition instanceof ObjectNode) {
      if (definition.name === "Mutation") return false;
      if (!definition.fields?.length) return false;
      return true;
    }

    return false;
  }

  public normalize(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      const relation = this._getFieldRelation(definition, field);

      if (!relation || isClientOnly(field)) {
        continue;
      }

      if (relation.key) {
        if (isBelongsToRelationship(field)) {
          this._setRelationKey(
            definition,
            relation.key,
            this._getKeyTypeName(relation.target),
            isSemanticNullable(field)
          );
          continue;
        }

        this._setRelationKey(
          relation.target,
          relation.key,
          this._getKeyTypeName(definition),
          isSemanticNullable(field)
        );
      }
    }
  }

  execute(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      const relation = this._getFieldRelation(definition, field);

      if (!relation || relation.type === "oneToOne") {
        continue;
      }

      // With relay on, ConnectionPlugin turns the field into a connection instead.
      if (this.context.options.relay || isListTypeNode(field.type)) {
        continue;
      }

      const list = ListTypeNode.create(NonNullTypeNode.create(field.type.getTypeName()));
      field.setType(isNullableTypeNode(field.type) ? list : NonNullTypeNode.create(list));
    }
  }

  public cleanup(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      if (isOneRelationship(field)) {
        field.removeDirective(RelationDirective.HAS_ONE);
      }

      if (isBelongsToRelationship(field)) {
        field.removeDirective(RelationDirective.BELONGS_TO);
      }

      if (isManyRelationship(field)) {
        field.removeDirective(RelationDirective.HAS_MANY);
      }
    }
  }

  after(): void {
    this.context.document
      .removeNode(RelationDirective.HAS_ONE)
      .removeNode(RelationDirective.BELONGS_TO)
      .removeNode(RelationDirective.HAS_MANY);
  }
}

export const relationPlugin = createPluginFactory(RelationsPlugin);
