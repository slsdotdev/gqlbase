import {
  DirectiveDefinitionNode as IDirectiveDefinitionNode,
  InputValueDefinitionNode,
  Kind,
} from "graphql";
import { InputValueNode } from "./InputValueNode";

type Location =
  | "SCHEMA"
  | "SCALAR"
  | "OBJECT"
  | "FIELD_DEFINITION"
  | "ARGUMENT_DEFINITION"
  | "INTERFACE"
  | "UNION"
  | "ENUM"
  | "ENUM_VALUE"
  | "INPUT_OBJECT"
  | "INPUT_FIELD_DEFINITION";

export class DirectiveDefinitionNode {
  kind: Kind.DIRECTIVE_DEFINITION = Kind.DIRECTIVE_DEFINITION;
  name: string;
  repeatable: boolean;
  locations: Location[];
  arguments?: InputValueNode[];

  constructor(name: string, locations: Location[], args?: InputValueNode[], repeatable?: boolean) {
    this.name = name;
    this.locations = locations;
    this.arguments = args;
    this.repeatable = repeatable ?? false;
  }

  public hasArgument(arg: string) {
    return this.arguments?.some((argument) => argument.name === arg) ?? false;
  }

  public getArgument(arg: string) {
    return this.arguments?.find((argument) => argument.name === arg);
  }

  public addArgument(argument: InputValueNode | InputValueDefinitionNode) {
    const argumentNode =
      argument instanceof InputValueNode ? argument : InputValueNode.fromDefinition(argument);

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

  public serialize(): IDirectiveDefinitionNode {
    return {
      kind: Kind.DIRECTIVE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      repeatable: this.repeatable,
      locations: this.locations.map((value) => {
        return {
          kind: Kind.NAME,
          value,
        };
      }),
      arguments: this.arguments?.map((arg) => arg.serialize()) ?? undefined,
    };
  }

  static fromDefinition(definition: IDirectiveDefinitionNode) {
    return new DirectiveDefinitionNode(
      definition.name.value,
      definition.locations.map((node) => node.value as Location),
      definition.arguments?.map((arg) => InputValueNode.fromDefinition(arg)),
      definition.repeatable
    );
  }

  static create(
    name: string,
    locations: Location | Location[],
    args?: InputValueNode | InputValueNode[],
    repeatable?: boolean
  ) {
    return new DirectiveDefinitionNode(
      name,
      Array.isArray(locations) ? locations : [locations],
      args instanceof InputValueNode ? [args] : args,
      repeatable
    );
  }
}
