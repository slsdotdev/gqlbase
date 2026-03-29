import { Kind, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, StringValueNode } from "graphql";
import { FieldNode } from "./FieldNode.js";
import { DirectiveNode } from "./DirectiveNode.js";
import { NamedTypeNode } from "./TypeNode.js";
import { WithInterfaceNode } from "./WithInterfaceNode.js";

export class ObjectNode extends WithInterfaceNode {
  kind: Kind.OBJECT_TYPE_DEFINITION = Kind.OBJECT_TYPE_DEFINITION;

  public extend(definition: ObjectTypeExtensionNode) {
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

  public serialize(): ObjectTypeDefinitionNode {
    return {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      description: this.description,
      fields: this.fields?.map((field) => field.serialize()),
      interfaces: this.interfaces?.map((iface) => iface.serialize()),
      directives: this.directives?.map((node) => node.serialize()),
    };
  }

  static fromDefinition(definition: ObjectTypeDefinitionNode): ObjectNode {
    return new ObjectNode(
      definition.name.value,
      definition.description,
      definition.directives?.map((node) => DirectiveNode.fromDefinition(node)),
      definition.fields?.map((field) => FieldNode.fromDefinition(field)),
      definition.interfaces?.map((node) => NamedTypeNode.fromDefinition(node))
    );
  }

  static create(
    name: string,
    description?: StringValueNode,
    directives?: DirectiveNode[],
    fields: FieldNode[] = [],
    interfaces?: NamedTypeNode[]
  ): ObjectNode {
    return new ObjectNode(name, description, directives, fields, interfaces);
  }
}
