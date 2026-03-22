import { FieldNode, ListTypeNode, NonNullTypeNode, TypeNode } from "@gqlbase/core/definition";

export const RfcDirective = {
  SEMANTIC_NON_NULL: "semanticNonNull",
} as const;

/**
 * Unwraps a type to the given depth level.
 * Only `ListTypeNode` counts as a level — `NonNullTypeNode` is
 * a modifier at the same depth and is skipped transparently.
 */
const getTypeAtLevel = (type: TypeNode, level: number): TypeNode => {
  if (level <= 0) return type;

  if (type instanceof NonNullTypeNode) return getTypeAtLevel(type.type, level);
  if (type instanceof ListTypeNode) return getTypeAtLevel(type.type, level - 1);

  return type;
};

/**
 * Determines if a field is semantically nullable based on its type and/or the presence of the `@semanticNonNull` directive.
 *
 * @param field Fiel node to check
 * @param level Semantic nullability level
 *
 * @returns `false` if the field is non-nullable either by being a NonNullType or by having the `@semanticNonNull` directive at the specified level, `true` otherwise.
 */

export const isSemanticNullable = (field: FieldNode, level = 0) => {
  const typeAtLevel = getTypeAtLevel(field.type, level);

  if (typeAtLevel instanceof NonNullTypeNode) {
    return false;
  }

  if (field.hasDirective(RfcDirective.SEMANTIC_NON_NULL)) {
    const directive = field.getDirective(RfcDirective.SEMANTIC_NON_NULL);
    const { levels = [0] } = directive?.getArgumentsJSON<{ levels: number[] }>() ?? {};

    return !levels?.includes(level);
  }

  return true;
};
