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
  getRelationMembers,
} from "./RelationsPlugin.utils.js";
import { isClientOnly, UtilityDirective } from "../UtilitiesPlugin/index.js";
import { isSemanticNullable } from "../RfcFeaturesPlugin/RfcFeaturesPlugin.utils.js";
import { isModel } from "../ModelPlugin/ModelPlugin.utils.js";
import { getScope } from "../TenancyPlugin/TenancyPlugin.utils.js";
import { BaseScalar } from "../ScalarsPlugin/ScalarsPlugin.utils.js";

/**
 * Adds the `@hasOne`, `@hasMany` and `@belongsTo` relation directives, the key fields they need, and the list shape of `@hasMany` fields.
 *
 * Key placement (see `parseFieldRelation`):
 * - `@belongsTo` stores the key on the **source** type: `camelCase(<field>, "id")`, or `key:`.
 * - `@hasOne` and `@hasMany` store the key on the **target** type: `camelCase(<source type>, "id")`, or `key:`.
 *
 * Keys are added as `@serverOnly @writeOnly` fields, so they are stored but not in the output schema.
 *
 * A key is added only when both ends are stored types (see `_isStored`). Any other relation is resolved by a resolver: it keeps its
 * shape and arguments, but gets no key.
 *
 * @definition
 * ```graphql
 * directive `@hasOne(key: String)` on FIELD_DEFINITION
 * directive `@hasMany(key: String)` on FIELD_DEFINITION
 * directive `@belongsTo(key: String, discriminator: String)` on FIELD_DEFINITION
 * ```
 *
 * @example
 * ```graphql
 * # Before
 * type User {
 *   id: ID!
 *   posts: Post `@hasMany(key: "authorId")`
 *   profile: Profile `@hasOne`
 * }
 *
 * type Post {
 *   id: ID!
 *   author: User `@belongsTo`
 * }
 *
 * type Profile {
 *   id: ID!
 * }
 *
 * # After (with the `relay` option off; with it on, `ConnectionPlugin` makes `posts` a connection)
 * type User {
 *   id: ID!
 *   posts: [Post!]    # `Post!` would become `[Post!]!`
 *   profile: Profile
 * }
 *
 * type Post {
 *   id: ID!
 *   authorId: ID      # from @hasMany(key: "authorId") and @belongsTo on author
 *   author: User
 * }
 *
 * type Profile {
 *   id: ID!
 *   userId: ID        # from @hasOne: the key goes on the target
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

  /**
   * A stored type has a table: a `@model` that is not `@clientOnly`. An interface or a union is stored when every type implementing it, or
   * every member, is.
   */
  private _isStored(node: RelationTarget): boolean {
    if (isObjectNode(node)) {
      return isModel(node) && !isClientOnly(node);
    }

    if (isInterfaceNode(node) && isClientOnly(node)) {
      return false;
    }

    const members = getRelationMembers(this.context.document, node);

    return members.length > 0 && members.every((member) => this._isStored(member));
  }

  /**
   * The type of the ids a key holds: the target's id type. For a union or an interface, the members' id type, `ID` when
   * they differ. Members cannot mix `GUID` ids with others: the key column is a global id for all of them or none.
   */
  private _getKeyTypeName(target: RelationTarget, relation: string): string {
    if (isObjectNode(target) || (isInterfaceNode(target) && target.hasField("id"))) {
      const idField = target.getField("id");

      if (!idField) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Relation ${relation} needs the id of ${target.name} for its key, but ${target.name} has no id field.`
        );
      }

      return idField.type.getTypeName();
    }

    const idTypes = new Set<string>();

    for (const member of getRelationMembers(this.context.document, target)) {
      const idField = member.getField("id");

      if (!idField) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Relation ${relation} needs an id on every member of ${target.name}, but ${member.name} has no id field.`
        );
      }

      idTypes.add(idField.type.getTypeName());
    }

    if (idTypes.size > 1 && idTypes.has(BaseScalar.GUID)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Relation ${relation} targets ${target.name}, whose members mix GUID ids with ${[...idTypes].filter((type) => type !== BaseScalar.GUID).join(", ")}. Give every member a GUID id, or none.`
      );
    }

    return idTypes.size === 1 ? [...idTypes][0] : "ID";
  }

  private _getFieldRelation(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): FieldRelationship | null {
    if (!isRelationField(field)) {
      return null;
    }

    const target = this._getRelationshipTarget(object, field);
    return target ? parseFieldRelation(object, field, target, this.context.options) : null;
  }

  /**
   * A declared key holds the target's ids, so it has the target's id type. Only enforced where `GUID` is involved:
   * `ID` and `UUID` keys have always been interchangeable, while a `GUID` key and its target must agree for the
   * global id pair to hold. A tenancy claim keeps the type its scope declares; the generators follow the target.
   */
  private _checkDeclaredKeyType(
    node: ObjectNode | InterfaceNode,
    field: FieldNode,
    typeName: string
  ) {
    const declared = field.type.getTypeName();

    if (declared === typeName || (declared !== BaseScalar.GUID && typeName !== BaseScalar.GUID)) {
      return;
    }

    if (isObjectNode(node) && getScope(node, this.context.options)?.claims[field.name]) {
      return;
    }

    throw new TransformerPluginExecutionError(
      this.name,
      `${node.name}.${field.name} is a relation key of type ${declared}, but the ids it holds are ${typeName}. Declare it as ${typeName}.`
    );
  }

  private _setRelationKey(
    node: RelationTarget,
    key: string,
    typeName: string,
    isNullable: boolean
  ) {
    // A union or an interface stands for its members: each one stores the key.
    if (isUnionNode(node) || isInterfaceNode(node)) {
      for (const member of getRelationMembers(this.context.document, node)) {
        this._setRelationKey(member, key, typeName, isNullable);
      }

      return;
    }

    const declared = node.getField(key);

    if (declared) {
      this._checkDeclaredKeyType(node, declared, typeName);
      return;
    }

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

  /**
   * The key of a `@hasOne` or `@hasMany`, on every member of the target. The relation's nullability is about what it
   * resolves, not what a target row must store, so the key is nullable. A member whose own `@belongsTo` stores the same
   * key is left to it: that relation says whether the key is required, whichever is normalized first.
   */
  private _setInverseRelationKey(
    source: ObjectNode | InterfaceNode,
    target: RelationTarget,
    key: string,
    typeName: string,
    relation: string
  ) {
    for (const member of getRelationMembers(this.context.document, target)) {
      if (!this._hasBelongsToKey(member, key, source, relation)) {
        this._setRelationKey(member, key, typeName, true);
      }
    }
  }

  /**
   * Whether a keyed `@belongsTo` of the type, or of an interface it implements, stores `key` on it. Relations pair by
   * key name, so that `@belongsTo` must point back at the source of the inverse relation: every object the source stands
   * for must be one its target stands for (the same type, or a union or an interface that includes them). Otherwise one
   * column would hold the ids of two different relations, which throws.
   */
  private _hasBelongsToKey(
    node: ObjectNode,
    key: string,
    source: ObjectNode | InterfaceNode,
    relation: string
  ): boolean {
    const owners = [
      node,
      ...(node.interfaces ?? [])
        .map((type) => this.context.document.getNode(type.getTypeName()))
        .filter((owner): owner is InterfaceNode => !!owner && isInterfaceNode(owner)),
    ];

    for (const owner of owners) {
      for (const field of owner.fields ?? []) {
        if (!isBelongsToRelationship(field)) {
          continue;
        }

        const belongsTo = this._getFieldRelation(owner, field);

        if (belongsTo?.key !== key || !this._isKeyed(owner, field, belongsTo.target)) {
          continue;
        }

        const members = getRelationMembers(this.context.document, belongsTo.target);
        const outside = getRelationMembers(this.context.document, source).filter(
          (object) => !members.includes(object)
        );

        if (outside.length) {
          throw new TransformerPluginExecutionError(
            this.name,
            `${relation} and ${owner.name}.${field.name} both use key "${key}", but ${owner.name}.${field.name} points at ${belongsTo.target.name}, which does not include ${outside.map((object) => object.name).join(", ")}. Give one of them another key.`
          );
        }

        return true;
      }
    }

    return false;
  }

  /**
   * The source field of a `@belongsTo` to a union or an interface that holds which member a row points at, beside the
   * key. Hidden like the key: with `GUID` members, the store fills it from the id.
   */
  private _setDiscriminator(node: ObjectNode | InterfaceNode, name: string, isNullable: boolean) {
    if (node.hasField(name)) {
      return;
    }

    node.addField(
      FieldNode.create(
        name,
        undefined,
        [
          DirectiveNode.create(UtilityDirective.SERVER_ONLY),
          DirectiveNode.create(UtilityDirective.WRITE_ONLY),
        ],
        isNullable ? NamedTypeNode.create("String") : NonNullTypeNode.create("String")
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
          [
            InputValueNode.create("key", undefined, undefined, "String"),
            InputValueNode.create("discriminator", undefined, undefined, "String"),
          ]
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

  /**
   * Without a table at both ends there is no row to key on: a resolver serves the relation, and no key field is added.
   */
  private _isKeyed(
    definition: ObjectNode | InterfaceNode,
    field: FieldNode,
    target: RelationTarget
  ) {
    return !isClientOnly(field) && this._isStored(definition) && this._isStored(target);
  }

  /**
   * A relation that gets no key can still declare one: the field its resolver queries by. It is not added (a plain parent has no id to type it
   * with), so it must exist, on the type that would hold the key.
   */
  private _checkDeclaredKey(
    definition: ObjectNode | InterfaceNode,
    field: FieldNode,
    relation: FieldRelationship
  ) {
    const directive = [
      RelationDirective.HAS_ONE,
      RelationDirective.HAS_MANY,
      RelationDirective.BELONGS_TO,
    ]
      .map((name) => field.getDirective(name))
      .find(Boolean);

    const key = directive?.getArgumentsJSON<{ key?: string }>()?.key;

    if (!key || this._isKeyed(definition, field, relation.target)) {
      return;
    }

    const holder = isBelongsToRelationship(field) ? definition : relation.target;
    const holders = isUnionNode(holder)
      ? (holder.types ?? []).map((type) => this.context.document.getNode(type.getTypeName()))
      : [holder];

    for (const node of holders) {
      if (node && (isObjectNode(node) || isInterfaceNode(node)) && !node.hasField(key)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `${definition.name}.${field.name} declares key "${key}", but ${node.name} has no field ${key}. A relation that is not between two stored models gets no key field, so declare it.`
        );
      }
    }
  }

  public normalize(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      const relation = this._getFieldRelation(definition, field);

      if (!relation?.key || !this._isKeyed(definition, field, relation.target)) {
        continue;
      }

      const name = `${definition.name}.${field.name}`;

      if (isBelongsToRelationship(field)) {
        this._setRelationKey(
          definition,
          relation.key,
          this._getKeyTypeName(relation.target, name),
          isSemanticNullable(field)
        );

        if (relation.discriminator) {
          this._setDiscriminator(definition, relation.discriminator, isSemanticNullable(field));
        }

        continue;
      }

      this._setInverseRelationKey(
        definition,
        relation.target,
        relation.key,
        this._getKeyTypeName(definition, name),
        name
      );
    }
  }

  execute(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      const relation = this._getFieldRelation(definition, field);

      if (!relation) {
        continue;
      }

      // In execute, so keys that other types add while normalizing are there.
      this._checkDeclaredKey(definition, field, relation);

      if (relation.type === "oneToOne") {
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
