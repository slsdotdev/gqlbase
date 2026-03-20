import { Kind } from "graphql";
import { DefinitionNode, ScalarNode } from "../../definition/index.js";
import { WithDirectivesNode } from "../../definition/WithDirectivesNode.js";

export const InternalDirective = Object.freeze({
  INTERNAL: "gqlbase_internal",
  TYPE_HINT: "gqlbase_typehint",
});

export const TypeHintValue = Object.freeze({
  id: "id",
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  UNKNOWN: "unknown",
});

export type TypeHintValueType = (typeof TypeHintValue)[keyof typeof TypeHintValue];

/**
 * Utility function to check if a node is marked as internal (_@gqlbase_internal_).
 * @param node - The node to check.
 * @returns True if the node is marked as internal, false otherwise.
 */

export const isInternal = (node: DefinitionNode): boolean => {
  if (node instanceof WithDirectivesNode) {
    return node.hasDirective(InternalDirective.INTERNAL);
  }

  return false;
};

/**
 * Utility function to get the type hint from a scalar node. If the node has a _@gqlbase_typehint_ directive, it returns the value of the `type` argument. Otherwise, it defaults to "string".
 *
 * @param node - Scalar node to check for type hint annotatation
 * @returns The type hint specified in the directive or "string" if no directive is present.
 * @default "string"
 *
 * @example
 *
 * ```graphql
 * scalar DateTime \@gqlbase_typehint(type: "string")
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
