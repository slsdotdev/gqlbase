import {
  DefinitionNode,
  DocumentNode,
  FieldNode,
  InterfaceNode,
  isInterfaceNode,
  isObjectLike,
  isObjectNode,
  isOperationNode,
  isUnionNode,
  ObjectNode,
  UnionNode,
} from "../../definition/index.js";
import { camelCase } from "@gqlbase/shared/format";

export const RelationDirective = {
  HAS_ONE: "hasOne",
  HAS_MANY: "hasMany",
  BELONGS_TO: "belongsTo",
} as const;

export interface FieldRelationship {
  type: "oneToOne" | "oneToMany";
  target: ObjectNode | InterfaceNode | UnionNode;
  key?: string | null;
  /**
   * For a `@belongsTo` to a union or an interface: the source field holding which member a row points at.
   */
  discriminator?: string | null;
}

export type RelationTarget = ObjectNode | InterfaceNode | UnionNode;

export const isOneRelationship = (field: FieldNode): boolean => {
  return field.hasDirective(RelationDirective.HAS_ONE);
};

export const isManyRelationship = (field: FieldNode): boolean => {
  return field.hasDirective(RelationDirective.HAS_MANY);
};

export const isBelongsToRelationship = (field: FieldNode): boolean => {
  return field.hasDirective(RelationDirective.BELONGS_TO);
};

export const isRelationField = (field: FieldNode): boolean => {
  return isOneRelationship(field) || isBelongsToRelationship(field) || isManyRelationship(field);
};

export const isValidRelationTarget = (node: DefinitionNode): node is RelationTarget => {
  return isObjectLike(node);
};

/**
 * Whether a relation target stands for several types: a union, or an interface.
 */
export const isPolymorphicTarget = (target: RelationTarget): target is InterfaceNode | UnionNode => {
  return isUnionNode(target) || isInterfaceNode(target);
};

/**
 * The object types a relation target stands for: the target itself, a union's members, or the objects implementing an
 * interface.
 */
export const getRelationMembers = (document: DocumentNode, target: RelationTarget): ObjectNode[] => {
  if (isObjectNode(target)) {
    return [target];
  }

  if (isUnionNode(target)) {
    return (target.types ?? [])
      .map((type) => document.getNode(type.getTypeName()))
      .filter((member): member is ObjectNode => !!member && isObjectNode(member));
  }

  return Array.from(document.definitions.values()).filter(
    (candidate): candidate is ObjectNode =>
      isObjectNode(candidate) && candidate.hasInterface(target.name)
  );
};

export const parseFieldRelation = (
  object: ObjectNode | InterfaceNode,
  field: FieldNode,
  target: RelationTarget
): FieldRelationship | null => {
  const relationships = [
    isOneRelationship(field),
    isManyRelationship(field),
    isBelongsToRelationship(field),
  ].filter(Boolean);

  if (relationships.length > 1) {
    throw new Error(`Multiple relationship directives detected for field: ${field.name}`);
  }

  if (isOneRelationship(field)) {
    const directive = field.getDirective(RelationDirective.HAS_ONE);
    const args = directive?.getArgumentsJSON<{ key: string }>();
    let key = args?.key ?? null;

    if (!key && !isOperationNode(object)) {
      key = camelCase(object.name, "id");
    }

    return {
      type: "oneToOne",
      target: target,
      key,
    };
  }

  if (isBelongsToRelationship(field)) {
    const directive = field.getDirective(RelationDirective.BELONGS_TO);
    const args = directive?.getArgumentsJSON<{ key: string; discriminator: string }>();
    let key = args?.key ?? null;

    if (!key && !isOperationNode(object)) {
      key = camelCase(field.name, "id");
    }

    const discriminator =
      key && isPolymorphicTarget(target)
        ? (args?.discriminator ?? camelCase(field.name, "type"))
        : null;

    return {
      type: "oneToOne",
      target: target,
      key,
      discriminator,
    };
  }

  if (isManyRelationship(field)) {
    const directive = field.getDirective(RelationDirective.HAS_MANY);
    const args = directive?.getArgumentsJSON<{ key: string }>();
    let key = args?.key ?? null;

    if (!key && !isOperationNode(object)) {
      key = camelCase(object.name, "id");
    }

    return {
      type: "oneToMany",
      target: target,
      key,
    };
  }

  return null;
};
