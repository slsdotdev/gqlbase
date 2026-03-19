import {
  DefinitionNode,
  FieldNode,
  InterfaceNode,
  ObjectNode,
  UnionNode,
} from "@gqlbase/core/definition";

export interface RelationPluginOptions {
  useConnections?: boolean;
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

export const isOneRelationship = (field: FieldNode): boolean => {
  return field.hasDirective(RelationDirective.HAS_ONE);
};

export const isManyRelationship = (field: FieldNode): boolean => {
  return field.hasDirective(RelationDirective.HAS_MANY);
};

export const isRelationField = (field: FieldNode): boolean => {
  return isOneRelationship(field) || isManyRelationship(field);
};

export const isConnectionNode = (node: DefinitionNode): boolean => {
  if (node instanceof ObjectNode) {
    if (!node.name.endsWith("Connection")) return false;
    if (!node.fields || node.fields.length < 2) return false;
    if (!node.hasField("items") || !node.hasField("nextToken")) return false;
    return true;
  }

  return false;
};

export const isValidRelationTarget = (
  node: DefinitionNode
): node is ObjectNode | InterfaceNode | UnionNode => {
  return node instanceof ObjectNode || node instanceof InterfaceNode || node instanceof UnionNode;
};
