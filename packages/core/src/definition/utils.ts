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

export const isUnionNode = (node: DefinitionNode): node is ObjectNode => {
  return node.kind === Kind.UNION_TYPE_DEFINITION;
};
