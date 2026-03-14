import { ConstArgumentNode, ConstDirectiveNode, Kind } from "graphql";
import { ArgumentNode } from "./ArgumentNode";
import { ValueType } from "./ValueNode";

export class DirectiveNode {
  kind: Kind.DIRECTIVE = Kind.DIRECTIVE;
  name: string;
  arguments?: ArgumentNode[] | undefined;

  constructor(name: string, args?: ArgumentNode[]) {
    this.name = name;
    this.arguments = args;
  }

  public hasArgument(arg: string) {
    return this.arguments?.some((argument) => argument.name === arg) ?? false;
  }

  public getArgument(arg: string) {
    return this.arguments?.find((argument) => argument.name === arg);
  }

  public addArgument(argument: ArgumentNode | ConstArgumentNode) {
    const argumentNode =
      argument instanceof ArgumentNode ? argument : ArgumentNode.fromDefinition(argument);

    if (this.hasArgument(argumentNode.name)) {
      throw new Error(`Argument ${argument.name} already exists on field ${this.name}`);
    }

    this.arguments = this.arguments ?? [];
    this.arguments.push(argumentNode);
    return this;
  }

  public removeArgument(arg: string) {
    this.arguments = this.arguments?.filter((argument) => argument.name !== arg);
    return this;
  }

  public getArgumentsJSON<
    T extends Record<string, ValueType> = Record<string, ValueType>,
  >(): Partial<T> {
    return (
      this.arguments?.reduce((acc, argument) => {
        return { ...acc, ...argument.toJSON() };
      }, {}) ?? {}
    );
  }

  public serialize(): ConstDirectiveNode {
    return {
      kind: Kind.DIRECTIVE,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      arguments: this.arguments?.map((arg) => arg.serialize()),
    };
  }

  static create(name: string, args?: ArgumentNode[]) {
    return new DirectiveNode(name, args);
  }

  static fromDefinition(definition: ConstDirectiveNode) {
    const args = definition.arguments?.map((arg) => new ArgumentNode(arg.name.value, arg.value));

    return new DirectiveNode(definition.name.value, args);
  }
}
