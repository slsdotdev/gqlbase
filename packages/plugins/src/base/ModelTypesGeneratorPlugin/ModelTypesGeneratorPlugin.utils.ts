import { DefinitionNode } from "@gqlbase/core/definition";

const OPERATION_NODE_NAME = ["Query", "Mutation", "Subscription"] as const;

export const isOperationNode = (node: DefinitionNode) => {
  return OPERATION_NODE_NAME.includes(node.name as (typeof OPERATION_NODE_NAME)[number]);
};

export const getBuildinScalarTypeKeyword = (typeName: string): string => {
  switch (typeName) {
    case "ID":
    case "String":
      return "string";
    case "Int":
    case "Float":
      return "number";
    case "Boolean":
      return "boolean";
    default:
      throw new Error(`Unsupported build-in scalar type: ${typeName}`);
  }
};
