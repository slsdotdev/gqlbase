import { FieldDefinitionNode, InputValueDefinitionNode, Kind } from "graphql";
import { WithDirectivesNode } from "./WithDirectivesNode";
import { InputValueNode } from "./InputValueNode";
import { DirectiveNode } from "./DirectiveNode";
import { ListTypeNode, NamedTypeNode, NonNullTypeNode, TypeNode } from "./TypeNode";

export class FieldNode extends WithDirectivesNode {
  readonly kind: Kind.FIELD_DEFINITION = Kind.FIELD_DEFINITION;
  readonly name: string;
  public type: TypeNode;
  arguments?: InputValueNode[] | undefined;

  constructor(
    name: string,
    type: TypeNode,
    args?: InputValueNode[] | null,
    directives?: DirectiveNode[] | undefined
  ) {
    super(name, directives);
    this.name = name;
    this.type = type;
    this.arguments = args ?? undefined;
  }

  public hasArgument(name: string) {
    return this.arguments?.some((arg) => arg.name === name) ?? false;
  }

  public getArgument(arg: string) {
    return this.arguments?.find((argument) => argument.name === arg);
  }

  public addArgument(argument: InputValueNode | InputValueDefinitionNode) {
    const node =
      argument instanceof InputValueNode ? argument : InputValueNode.fromDefinition(argument);

    if (this.hasArgument(node.name)) {
      throw new Error(`Argument ${node.name} already exists on field ${this.name}`);
    }

    this.arguments = this.arguments ?? [];
    this.arguments.push(node);
    return this;
  }

  public removeArgument(name: string) {
    this.arguments = this.arguments?.filter((arg) => arg.name !== name);
    return this;
  }

  public setType(type: TypeNode) {
    this.type = type;
    return this;
  }

  public serialize(): FieldDefinitionNode {
    return {
      kind: Kind.FIELD_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      type: this.type.serialize(),
      arguments: this.arguments?.map((arg) => arg.serialize()),
      directives: this.directives?.map((directive) => directive.serialize()),
    };
  }

  static create(
    name: string,
    type: TypeNode,
    args?: InputValueNode[] | null,
    directives?: DirectiveNode[]
  ) {
    return new FieldNode(name, type, args ?? null, directives);
  }

  static fromDefinition(field: FieldDefinitionNode) {
    return new FieldNode(
      field.name.value,
      field.type.kind === Kind.NON_NULL_TYPE
        ? NonNullTypeNode.fromDefinition(field.type)
        : field.type.kind === Kind.LIST_TYPE
          ? ListTypeNode.fromDefinition(field.type)
          : NamedTypeNode.fromDefinition(field.type),
      field.arguments?.map((arg) => InputValueNode.fromDefinition(arg)) ?? null,
      field.directives?.map((directive) => DirectiveNode.fromDefinition(directive)) ?? undefined
    );
  }
}
