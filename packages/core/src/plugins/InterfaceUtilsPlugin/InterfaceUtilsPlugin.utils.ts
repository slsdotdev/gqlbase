import { InterfaceNode, ObjectNode } from "../../definition/index.js";

export const hasInterfaces = (node: ObjectNode | InterfaceNode): boolean => {
  return Array.isArray(node.interfaces) && node.interfaces.length > 0;
};
