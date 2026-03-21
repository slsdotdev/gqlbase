import { FieldNode, NonNullTypeNode } from "@gqlbase/core/definition";

export const RfcDirective = {
  SEMANTIC_NON_NULL: "semanticNonNull",
} as const;

export const isSemanticNullable = (field: FieldNode, level = 0) => {
  if (field.type instanceof NonNullTypeNode) {
    return false;
  }

  if (field.hasDirective(RfcDirective.SEMANTIC_NON_NULL)) {
    const directive = field.getDirective(RfcDirective.SEMANTIC_NON_NULL);
    const { levels = [0] } = directive?.getArgumentsJSON<{ levels: number[] }>() ?? {};

    return !levels?.includes(level);
  }

  return true;
};
