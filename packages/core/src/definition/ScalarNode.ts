import { Kind, ScalarTypeDefinitionNode, ScalarTypeExtensionNode, StringValueNode } from "graphql";
import { DirectiveNode } from "./DirectiveNode.js";
import { WithDirectivesNode } from "./WithDirectivesNode.js";

export class ScalarNode extends WithDirectivesNode {
  kind: Kind.SCALAR_TYPE_DEFINITION = Kind.SCALAR_TYPE_DEFINITION;

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
      description: this.description,
      directives: this.directives?.map((node) => node.serialize()),
    };
  }

  static fromDefinition(definition: ScalarTypeDefinitionNode) {
    return new ScalarNode(
      definition.name.value,
      definition.description,
      definition.directives?.map((directive) => DirectiveNode.fromDefinition(directive))
    );
  }

  static create(name: string, description?: StringValueNode, directives?: DirectiveNode[]) {
    return new ScalarNode(name, description, directives);
  }
}
