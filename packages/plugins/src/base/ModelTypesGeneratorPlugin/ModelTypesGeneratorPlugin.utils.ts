import { DefinitionNode } from "@gqlbase/core/definition";

export interface ModelTypesGeneratorPluginOptions {
  /**
   * The output file name for the generated types.
   * @default "models.typegen.ts"
   */
  fileName?: string;

  /**
   * Whether to include the generated types in the output object.
   * @default false
   */
  emitOutput?: boolean;
}

export const DEFAULT_OPTIONS: Required<ModelTypesGeneratorPluginOptions> = {
  fileName: "models.typegen.ts",
  emitOutput: false,
} as const;

export const mergeOptions = (
  options?: ModelTypesGeneratorPluginOptions
): Required<ModelTypesGeneratorPluginOptions> => {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
};

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
