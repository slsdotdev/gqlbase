import {
  DefinitionNode,
  FieldNode,
  InputValueNode,
  NonNullTypeNode,
} from "@gqlbase/core/definition";

const OPERATION_NODE_NAME = ["Query", "Mutation", "Subscription"] as const;

export const isOperationNode = (node: DefinitionNode) => {
  return OPERATION_NODE_NAME.includes(node.name as (typeof OPERATION_NODE_NAME)[number]);
};

/**
 *
 * @param field Field node to check for non-nullability
 * @returns True if the field is non-nullable, false otherwise
 *
 * TODO: check for semantic nullability based on directives.
 */

export const isNonNullableField = (field: FieldNode | InputValueNode) => {
  return field.type instanceof NonNullTypeNode;
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
