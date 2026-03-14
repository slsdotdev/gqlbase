import { ConstArgumentNode, ConstValueNode, Kind } from "graphql";
import { ValueNode } from "./ValueNode";

export class ArgumentNode {
  kind: Kind.ARGUMENT = Kind.ARGUMENT;
  name: string;
  value: ConstValueNode;

  constructor(name: string, value: ConstValueNode) {
    this.name = name;
    this.value = value;
  }

  public serialize(): ConstArgumentNode {
    return {
      kind: Kind.ARGUMENT,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      value: this.value,
    };
  }

  public toJSON() {
    return { [this.name]: ValueNode.getValue(this.value) };
  }

  static create(name: string, value: ConstValueNode) {
    return new ArgumentNode(name, value);
  }

  static fromDefinition(definition: ConstArgumentNode) {
    return new ArgumentNode(definition.name.value, definition.value);
  }
}
