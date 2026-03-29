import { ASTNode, Kind, StringValueNode } from "graphql";

export abstract class WithDescriptionNode {
  abstract readonly kind: Kind;
  readonly name: string;
  public description?: StringValueNode;

  constructor(name: string, description?: StringValueNode) {
    this.name = name;
    this.description = description;
  }

  abstract serialize(): ASTNode;
}
