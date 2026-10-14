import { Kind } from "graphql";
import { ArgumentNode } from "./ArgumentNode.js";
import { DirectiveDefinitionNode } from "./DirectiveDefinitionNode.js";
import { DirectiveNode } from "./DirectiveNode.js";
import { EnumNode } from "./EnumNode.js";
import { EnumValueNode } from "./EnumValueNode.js";
import { FieldNode } from "./FieldNode.js";
import { InputObjectNode } from "./InputObjectNode.js";
import { InputValueNode } from "./InputValueNode.js";
import { InterfaceNode } from "./InterfaceNode.js";
import { ObjectNode } from "./ObjectNode.js";
import { ScalarNode } from "./ScalarNode.js";
import { UnionNode } from "./UnionNode.js";
import { ListTypeNode, NamedTypeNode, NonNullTypeNode, TypeNode } from "./TypeNode.js";

export type DefinitionNode =
  | InterfaceNode
  | ObjectNode
  | InputObjectNode
  | EnumNode
  | UnionNode
  | ScalarNode
  | DirectiveDefinitionNode;

export const isArgument = (node: unknown): node is ArgumentNode => {
  return node instanceof ArgumentNode;
};

export const isDirective = (node: unknown): node is DirectiveNode => {
  return node instanceof DirectiveNode;
};

export const isInputValueNode = (node: unknown): node is InputValueNode => {
  return node instanceof InputValueNode;
};

export const isEnumValueNode = (node: unknown): node is EnumValueNode => {
  return node instanceof EnumValueNode;
};

export const isFieldNode = (node: unknown): node is FieldNode => {
  return node instanceof FieldNode;
};

export const isDirectiveDefinitionNode = (
  node: DefinitionNode
): node is DirectiveDefinitionNode => {
  return node.kind === Kind.DIRECTIVE_DEFINITION;
};

export const isEnumNode = (node: DefinitionNode): node is EnumNode => {
  return node.kind === Kind.ENUM_TYPE_DEFINITION;
};

export const isInputObjectNode = (node: DefinitionNode): node is InputObjectNode => {
  return node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION;
};

export const isInterfaceNode = (node: DefinitionNode): node is InterfaceNode => {
  return node.kind === Kind.INTERFACE_TYPE_DEFINITION;
};

export const isObjectNode = (node: DefinitionNode): node is ObjectNode => {
  return node.kind === Kind.OBJECT_TYPE_DEFINITION;
};

export const isScalarNode = (node: DefinitionNode): node is ScalarNode => {
  return node.kind === Kind.SCALAR_TYPE_DEFINITION;
};

export const isUnionNode = (node: DefinitionNode): node is UnionNode => {
  return node.kind === Kind.UNION_TYPE_DEFINITION;
};

export const isObjectLike = (
  node: DefinitionNode
): node is ObjectNode | InterfaceNode | UnionNode => {
  return isObjectNode(node) || isInterfaceNode(node) || isUnionNode(node);
};

export const isListTypeNode = (node: TypeNode): boolean => {
  if (node instanceof NonNullTypeNode && node.type instanceof ListTypeNode) {
    return true;
  }

  return node instanceof ListTypeNode;
};

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
 * Determines if a type is nullable at the given level.
 *
 * @param type Type to check
 * @param level Level of nesting to check for nullability (0 for the type itself, 1 for one level of nesting, etc.)
 *
 * @returns `false` if the type is non-nullable at the specified level, `true` otherwise.
 */

export const isNullableTypeNode = (type: TypeNode, level = 0): boolean => {
  const typeAtLevel = getTypeAtLevel(type, level);

  return !(typeAtLevel instanceof NonNullTypeNode);
};

/**
 * A nullable copy of a type with the same list structure, and the levels that were non-null, counted as in
 * `isNullableTypeNode`. `[[X!]]!` gives `[[X]]` and `[0, 2]`.
 */
export const stripNonNull = (
  type: TypeNode
): { type: NamedTypeNode | ListTypeNode; levels: number[] } => {
  const levels: number[] = [];

  const strip = (node: TypeNode, level: number): NamedTypeNode | ListTypeNode => {
    if (node instanceof NonNullTypeNode) {
      levels.push(level);
      return strip(node.type, level);
    }

    if (node instanceof ListTypeNode) {
      return ListTypeNode.create(strip(node.type, level + 1));
    }

    return NamedTypeNode.create(node.name);
  };

  return { type: strip(type, 0), levels };
};

/**
 * A copy of a type with the named type `from` replaced by `to`, keeping its list and non-null wrappers.
 */
export const replaceNamedType = (type: TypeNode, from: string, to: string): TypeNode => {
  if (type instanceof NonNullTypeNode) {
    return NonNullTypeNode.create(
      replaceNamedType(type.type, from, to) as NamedTypeNode | ListTypeNode
    );
  }

  if (type instanceof ListTypeNode) {
    return ListTypeNode.create(replaceNamedType(type.type, from, to));
  }

  return type.name === from ? NamedTypeNode.create(to) : NamedTypeNode.create(type.name);
};

export const OPERATION_NODE_NAME = ["Query", "Mutation", "Subscription"] as const;

export const isOperationNode = (node: DefinitionNode): boolean => {
  return (
    isObjectNode(node) &&
    OPERATION_NODE_NAME.includes(node.name as (typeof OPERATION_NODE_NAME)[number])
  );
};
