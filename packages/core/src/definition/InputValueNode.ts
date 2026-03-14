import {
  ConstDirectiveNode,
  ConstValueNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  TypeNode as TypeNodeDefinition,
} from "graphql";
import { WithDirectivesNode } from "./WithDirectivesNode";
import { DirectiveNode } from "./DirectiveNode";
import { ListTypeNode, NamedTypeNode, NonNullTypeNode, TypeNode } from "./TypeNode";

export class InputValueNode extends WithDirectivesNode {
  kind: Kind.INPUT_VALUE_DEFINITION = Kind.INPUT_VALUE_DEFINITION;
  name: string;
  type: TypeNode;
  defaultValue?: ConstValueNode | undefined;

  constructor(
    name: string,
    type: TypeNode,
    defaultValue?: ConstValueNode | null,
    directives?: DirectiveNode[]
  ) {
    super(name, directives);

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
      type: this.type.serialize(),
      defaultValue: this.defaultValue,
      directives: this.directives?.map((directive) => directive.serialize()),
    };
  }

  static create(
    name: string,
    value: string | TypeNode | TypeNodeDefinition,
    defaultValue?: ConstValueNode,
    directives?: (string | DirectiveNode | ConstDirectiveNode)[]
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
      typeNode,
      defaultValue,
      directives?.map((directive) =>
        directive instanceof DirectiveNode
          ? directive
          : typeof directive === "string"
            ? DirectiveNode.create(directive)
            : DirectiveNode.fromDefinition(directive)
      )
    );
  }

  static fromDefinition(field: FieldDefinitionNode | InputValueDefinitionNode) {
    return new InputValueNode(
      field.name.value,
      field.type.kind === Kind.NON_NULL_TYPE
        ? NonNullTypeNode.fromDefinition(field.type)
        : field.type.kind === Kind.LIST_TYPE
          ? ListTypeNode.fromDefinition(field.type)
          : NamedTypeNode.fromDefinition(field.type),
      "defaultValue" in field ? field.defaultValue : null,
      field.directives?.map((directive) => DirectiveNode.fromDefinition(directive))
    );
  }
}
