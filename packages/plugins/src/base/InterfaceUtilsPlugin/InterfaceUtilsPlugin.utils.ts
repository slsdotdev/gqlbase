import { InterfaceNode, ObjectNode } from "@gqlbase/core/definition";

export const hasInterfaces = (node: ObjectNode | InterfaceNode): boolean => {
  return Array.isArray(node.interfaces) && node.interfaces.length > 0;
};
