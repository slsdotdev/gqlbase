import {
  DefinitionNode,
  FieldNode,
  InterfaceNode,
  ObjectNode,
  UnionNode,
} from "@gqlbase/core/definition";
import { camelCase } from "@gqlbase/shared/format";

export interface RelationPluginOptions {
  usePaginationTypes?: boolean;
}

export const RelationDirective = {
  HAS_ONE: "hasOne",
  HAS_MANY: "hasMany",
} as const;

export interface FieldRelationship {
  type: "oneToOne" | "oneToMany";
  target: ObjectNode | InterfaceNode | UnionNode;
  key?: string;
}

export type RelationTarget = ObjectNode | InterfaceNode | UnionNode;

export const isOneRelationship = (field: FieldNode): boolean => {
  return field.hasDirective(RelationDirective.HAS_ONE);
};

export const isManyRelationship = (field: FieldNode): boolean => {
  return field.hasDirective(RelationDirective.HAS_MANY);
};

export const isRelationField = (field: FieldNode): boolean => {
  return isOneRelationship(field) || isManyRelationship(field);
};

export const isPaginationConnection = (node: DefinitionNode): boolean => {
  if (node instanceof ObjectNode) {
    if (!node.name.endsWith("Connection")) return false;
    if (!node.fields || node.fields.length < 2) return false;
    if (!node.hasField("items") || !node.hasField("nextToken")) return false;
    return true;
  }

  return false;
};

export const isValidRelationTarget = (node: DefinitionNode): node is RelationTarget => {
  return node instanceof ObjectNode || node instanceof InterfaceNode || node instanceof UnionNode;
};

export const parseFieldRelation = (
  object: ObjectNode | InterfaceNode,
  field: FieldNode,
  target: RelationTarget
): Required<FieldRelationship> | null => {
  if (isOneRelationship(field) && isManyRelationship(field)) {
    throw new Error(`Multiple relationship directives detected for field: ${field.name}`);
  }

  if (isOneRelationship(field)) {
    const directive = field.getDirective(RelationDirective.HAS_ONE);
    const args = directive?.getArgumentsJSON<{ key: string }>();

    return {
      type: "oneToOne",
      target: target,
      key: args?.key ?? camelCase(field.name, "id"),
    };
  }

  if (isManyRelationship(field)) {
    const directive = field.getDirective(RelationDirective.HAS_MANY);
    const args = directive?.getArgumentsJSON<{ key: string }>();

    return {
      type: "oneToMany",
      target: target,
      key: args?.key ?? camelCase(object.name, "id"),
    };
  }

  return null;
};
