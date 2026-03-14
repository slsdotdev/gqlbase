import { Kind, ScalarTypeDefinitionNode, ScalarTypeExtensionNode } from "graphql";
import { DirectiveNode } from "./DirectiveNode";
import { WithDirectivesNode } from "./WithDirectivesNode";

export class ScalarNode extends WithDirectivesNode {
  kind: Kind.SCALAR_TYPE_DEFINITION = Kind.SCALAR_TYPE_DEFINITION;
  name: string;

  constructor(name: string, directives?: DirectiveNode[]) {
    super(name, directives);

    this.name = name;
  }

  public extend(definition: ScalarTypeExtensionNode) {
    this.directives = definition.directives?.map((directive) =>
      DirectiveNode.fromDefinition(directive)
    );
    return this;
  }

  public serialize(): ScalarTypeDefinitionNode {
    return {
      kind: Kind.SCALAR_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      directives: this.directives?.map((node) => node.serialize()),
    };
  }

  static fromDefinition(definition: ScalarTypeDefinitionNode) {
    return new ScalarNode(
      definition.name.value,
      definition.directives?.map((directive) => DirectiveNode.fromDefinition(directive))
    );
  }

  static create(name: string, directives?: DirectiveNode[]) {
    return new ScalarNode(name, directives);
  }
}
