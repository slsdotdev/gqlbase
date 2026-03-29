import {
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  Kind,
  StringValueNode,
} from "graphql";
import { WithInterfaceNode } from "./WithInterfaceNode.js";
import { FieldNode } from "./FieldNode.js";
import { DirectiveNode } from "./DirectiveNode.js";
import { NamedTypeNode } from "./TypeNode.js";

export class InterfaceNode extends WithInterfaceNode {
  kind: Kind.INTERFACE_TYPE_DEFINITION = Kind.INTERFACE_TYPE_DEFINITION;

  public extend(definition: InterfaceTypeExtensionNode) {
    const { fields, directives, interfaces } = definition;

    if (fields) {
      for (const field of fields) {
        this.addField(field);
      }
    }

    if (directives) {
      for (const directive of directives) {
        this.addDirective(directive);
      }
    }

    if (interfaces) {
      for (const iface of interfaces) {
        this.addInterface(iface);
      }
    }

    return this;
  }

  public serialize(): InterfaceTypeDefinitionNode {
    return {
      kind: Kind.INTERFACE_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      description: this.description,
      directives: this.directives?.map((node) => node.serialize()),
      fields: this.fields?.map((node) => node.serialize()),
      interfaces: this.interfaces?.map((node) => node.serialize()),
    };
  }

  static fromDefinition(definition: InterfaceTypeDefinitionNode) {
    return new InterfaceNode(
      definition.name.value,
      definition.description,
      definition.directives?.map((directive) => DirectiveNode.fromDefinition(directive)),
      definition.fields?.map((field) => FieldNode.fromDefinition(field)),
      definition.interfaces?.map((node) => NamedTypeNode.fromDefinition(node))
    );
  }

  static create(
    name: string,
    description?: StringValueNode,
    directives?: DirectiveNode[],
    fields?: FieldNode[],
    interfaces?: NamedTypeNode[]
  ): InterfaceNode {
    return new InterfaceNode(name, description, directives, fields, interfaces);
  }
}
