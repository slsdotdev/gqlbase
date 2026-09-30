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
  DirectiveNode,
  NonNullTypeNode,
} from "../../definition/index.js";
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

  private _getKeyTypeName(target: RelationTarget): string {
    if (isUnionNode(target)) {
      const idTypes = new Set<string>();

      for (const type of target.types ?? []) {
        const unionType = this.context.document.getNodeOrThrow(type.getTypeName());

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
    return parseFieldRelation(object, field, target);
  }

  private _setRelationKey(
    node: ObjectNode | InterfaceNode | UnionNode,
    key: string,
    typeName = "ID",
    isNullable = false
  ) {
    if (isUnionNode(node)) {
      for (const type of node.types ?? []) {
        const unionType = this.context.document.getNodeOrThrow(type.getTypeName());

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

  private _setConnectionArguments(field: FieldNode) {
    if (!field.hasArgument("limit")) {
      field.addArgument(
        InputValueNode.create("limit", undefined, undefined, NamedTypeNode.create("Int"))
      );
    }

    if (!field.hasArgument("nextToken")) {
      field.addArgument(
        InputValueNode.create("nextToken", undefined, undefined, NamedTypeNode.create("String"))
      );
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
        .addField(
          FieldNode.create(
            "items",
            undefined,
            undefined,
            ListTypeNode.create(NamedTypeNode.create(target.name))
          )
        )
        .addField(
          FieldNode.create("nextToken", undefined, undefined, NamedTypeNode.create("String"))
        )
    );
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
      if (isPaginationConnection(definition)) return false;
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
