import {
  ConstDirectiveNode,
  ConstValueNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  StringValueNode,
  TypeNode as TypeNodeDefinition,
} from "graphql";
import { WithDirectivesNode } from "./WithDirectivesNode.js";
import { DirectiveNode } from "./DirectiveNode.js";
import { ListTypeNode, NamedTypeNode, NonNullTypeNode, TypeNode } from "./TypeNode.js";

export class InputValueNode extends WithDirectivesNode {
  kind: Kind.INPUT_VALUE_DEFINITION = Kind.INPUT_VALUE_DEFINITION;
  name: string;
  type: TypeNode;
  defaultValue?: ConstValueNode | undefined;

  constructor(
    name: string,
    description: StringValueNode | undefined,
    directives: DirectiveNode[] | undefined,
    type: TypeNode,
    defaultValue?: ConstValueNode | null
  ) {
    super(name, description, directives);

    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue ?? undefined;
  }

  public serialize(): InputValueDefinitionNode {
    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      description: this.description,
      type: this.type.serialize(),
      defaultValue: this.defaultValue,
      directives: this.directives?.map((directive) => directive.serialize()),
    };
  }

  static create(
    name: string,
    description: StringValueNode | undefined,
    directives: (string | DirectiveNode | ConstDirectiveNode)[] | undefined,
    value: string | TypeNode | TypeNodeDefinition,
    defaultValue?: ConstValueNode
  ) {
    const typeNode =
      typeof value === "string"
        ? NamedTypeNode.create(value)
        : value instanceof NamedTypeNode ||
            value instanceof NonNullTypeNode ||
            value instanceof ListTypeNode
          ? value
          : value.kind === Kind.NON_NULL_TYPE
            ? NonNullTypeNode.fromDefinition(value)
            : value.kind === Kind.LIST_TYPE
              ? ListTypeNode.fromDefinition(value)
              : NamedTypeNode.fromDefinition(value);

    return new InputValueNode(
      name,
      description,
      directives?.map((directive) =>
        directive instanceof DirectiveNode
          ? directive
          : typeof directive === "string"
            ? DirectiveNode.create(directive)
            : DirectiveNode.fromDefinition(directive)
      ) ?? undefined,
      typeNode,
      defaultValue
    );
  }

  static fromDefinition(field: FieldDefinitionNode | InputValueDefinitionNode) {
    return new InputValueNode(
      field.name.value,
      field.description,
      field.directives?.map((directive) => DirectiveNode.fromDefinition(directive)),
      field.type.kind === Kind.NON_NULL_TYPE
        ? NonNullTypeNode.fromDefinition(field.type)
        : field.type.kind === Kind.LIST_TYPE
          ? ListTypeNode.fromDefinition(field.type)
          : NamedTypeNode.fromDefinition(field.type),
      "defaultValue" in field ? field.defaultValue : null
    );
  }
}
