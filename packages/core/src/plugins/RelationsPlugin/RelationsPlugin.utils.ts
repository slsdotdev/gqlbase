import {
  DefinitionNode,
  FieldNode,
  InterfaceNode,
  isObjectLike,
  isOperationNode,
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
    const args = directive?.getArgumentsJSON<{ key: string }>();
    let key = args?.key ?? null;

    if (!key && !isOperationNode(object)) {
      key = camelCase(field.name, "id");
    }

    return {
      type: "oneToOne",
      target: target,
      key,
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
