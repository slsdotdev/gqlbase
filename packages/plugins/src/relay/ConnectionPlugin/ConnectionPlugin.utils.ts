import { DefinitionNode, ObjectNode } from "@gqlbase/core/definition";

export const isRelayConnection = (node: DefinitionNode): boolean => {
  if (node instanceof ObjectNode) {
    if (!node.name.endsWith("Connection")) return false;
    if (!node.fields || node.fields.length < 2) return false;
    if (!node.hasField("edges") || !node.hasField("pageInfo")) return false;
    return true;
  }

  return false;
};

export const isRelayEdge = (node: DefinitionNode): boolean => {
  if (node instanceof ObjectNode) {
    if (!node.name.endsWith("Edge")) return false;
    if (!node.fields || node.fields.length < 2) return false;
    if (!node.hasField("node") || !node.hasField("cursor")) return false;
    return true;
  }

  return false;
};
