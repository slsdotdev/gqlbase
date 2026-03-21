import { FieldNode, NonNullTypeNode } from "@gqlbase/core/definition";

export const RfcDirective = {
  SEMANTIC_NON_NULL: "semanticNonNull",
} as const;

/**
 * Determines if a field is semantically nullable based on its type and/or the presence of the `@semanticNonNull` directive.
 *
 * @param field Fiel node to check
 * @param level Semantic nullability level
 * @returns `false` if the field is non-nullable either by being a NonNullType or by having the `@semanticNonNull` directive at the specified level, `true` otherwise.
 */

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
