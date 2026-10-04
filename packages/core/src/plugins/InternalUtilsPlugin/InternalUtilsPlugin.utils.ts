import { Kind } from "graphql";
import { InputValueNode, ScalarNode } from "../../definition/index.js";
import { WithDirectivesNode } from "../../definition/WithDirectivesNode.js";

export const InternalDirective = Object.freeze({
  INTERNAL: "gqlbase_internal",
  TYPE_HINT: "gqlbase_typehint",
  TUPLE: "gqlbase_tuple",
});

export const TypeHintValue = Object.freeze({
  ID: "id",
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  OBJECT: "object",
  UNKNOWN: "unknown",
});

export type TypeHintValueType = (typeof TypeHintValue)[keyof typeof TypeHintValue];

/**
 * Utility function to check if a node is marked as internal (_@gqlbase_internal_).
 * @param node - The node to check.
 * @returns True if the node is marked as internal, false otherwise.
 */

export const isInternal = (node: unknown): boolean => {
  if (node instanceof WithDirectivesNode) {
    return node.hasDirective(InternalDirective.INTERNAL);
  }

  return false;
};

/**
 * Utility function to get the type hint from a scalar node. If the node has a _@gqlbase_typehint_ directive, it returns the value of the `type` argument, an enum value. Otherwise, it returns "unknown".
 *
 * @param node - Scalar node to check for type hint annotatation
 * @returns The type hint specified in the directive, or "unknown" if no directive is present.
 * @default "unknown"
 *
 * @example
 *
 * ```graphql
 * scalar DateTime \@gqlbase_typehint(type: string)
 * ```
 */

export const getTypeHint = (node: ScalarNode): TypeHintValueType => {
  const directive = node.getDirective(InternalDirective.TYPE_HINT);

  if (directive) {
    const typeArg = directive.getArgument("type");

    if (typeArg && typeArg.value.kind === Kind.ENUM) {
      return typeArg.value.value as TypeHintValueType;
    }
  }

  return "unknown";
};

/**
 * The size of a list input field marked `@gqlbase_tuple(size: n)`, or `null`. GraphQL has no fixed-size list: the generated TS types and
 * Zod schemas type such a field as an `n`-tuple, for example the `[low, high]` of a filter's `between`.
 */
export const getTupleSize = (node: InputValueNode): number | null => {
  const size = node.getDirective(InternalDirective.TUPLE)?.getArgument("size");

  if (size && size.value.kind === Kind.INT) {
    return Number(size.value.value);
  }

  return null;
};

/**
 * The type hint of a scalar on the input side: the `input` argument of _@gqlbase_typehint_ when present, the `type` otherwise.
 *
 * @example
 *
 * ```graphql
 * scalar AWSJSON \@gqlbase_typehint(type: object, input: string)
 * ```
 */
export const getInputTypeHint = (node: ScalarNode): TypeHintValueType => {
  const input = node.getDirective(InternalDirective.TYPE_HINT)?.getArgument("input");

  if (input && input.value.kind === Kind.ENUM) {
    return input.value.value as TypeHintValueType;
  }

  return getTypeHint(node);
};
