import { ConstDirectiveNode, EnumValueDefinitionNode, Kind, StringValueNode } from "graphql";
import { WithDirectivesNode } from "./WithDirectivesNode.js";
import { DirectiveNode } from "./DirectiveNode.js";

export class EnumValueNode extends WithDirectivesNode {
  kind: Kind.ENUM_VALUE_DEFINITION = Kind.ENUM_VALUE_DEFINITION;
  name: string;

  constructor(name: string, description?: StringValueNode, directives?: DirectiveNode[]) {
    super(name, description, directives);

    this.name = name;
  }

  public serialize(): EnumValueDefinitionNode {
    return {
      kind: Kind.ENUM_VALUE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      description: this.description,
      directives: this.directives?.map((node) => node.serialize()),
    };
  }

  static create(
    name: string,
    description?: StringValueNode,
    directives?: string[] | DirectiveNode[] | ConstDirectiveNode[]
  ) {
    return new EnumValueNode(
      name,
      description,
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
      definition.description,
      definition.directives?.map((directive) => DirectiveNode.fromDefinition(directive))
    );
  }
}
