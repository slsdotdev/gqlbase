import { ConstDirectiveNode, EnumValueDefinitionNode, Kind } from "graphql";
import { WithDirectivesNode } from "./WithDirectivesNode";
import { DirectiveNode } from "./DirectiveNode";

export class EnumValueNode extends WithDirectivesNode {
  kind: Kind.ENUM_VALUE_DEFINITION = Kind.ENUM_VALUE_DEFINITION;
  name: string;

  constructor(name: string, directives?: DirectiveNode[]) {
    super(name, directives);

    this.name = name;
  }

  public serialize(): EnumValueDefinitionNode {
    return {
      kind: Kind.ENUM_VALUE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      directives: this.directives?.map((node) => node.serialize()),
    };
  }

  static create(name: string, directives?: string[] | DirectiveNode[] | ConstDirectiveNode[]) {
    return new EnumValueNode(
      name,
      directives?.map((directive) =>
        directive instanceof DirectiveNode
          ? directive
          : typeof directive === "string"
            ? DirectiveNode.create(directive)
            : DirectiveNode.fromDefinition(directive)
      )
    );
  }

  static fromDefinition(definition: EnumValueDefinitionNode) {
    return new EnumValueNode(
      definition.name.value,
      definition.directives?.map((directive) => DirectiveNode.fromDefinition(directive))
    );
  }
}
