import { Kind, ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from "graphql";
import { FieldNode } from "./FieldNode";
import { DirectiveNode } from "./DirectiveNode";
import { NamedTypeNode } from "./TypeNode";
import { WithInterfaceNode } from "./WithInterfaceNode";

export class ObjectNode extends WithInterfaceNode {
  kind: Kind.OBJECT_TYPE_DEFINITION = Kind.OBJECT_TYPE_DEFINITION;
  name: string;

  constructor(
    name: string,
    fields?: FieldNode[],
    interfaces?: NamedTypeNode[],
    directives?: DirectiveNode[]
  ) {
    super(name, fields, interfaces, directives);

    this.name = name;
  }

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
      fields: this.fields?.map((field) => field.serialize()),
      interfaces: this.interfaces?.map((iface) => iface.serialize()),
      directives: this.directives?.map((node) => node.serialize()),
    };
  }

  static fromDefinition(definition: ObjectTypeDefinitionNode): ObjectNode {
    return new ObjectNode(
      definition.name.value,
      definition.fields?.map((field) => FieldNode.fromDefinition(field)),
      definition.interfaces?.map((node) => NamedTypeNode.fromDefinition(node)),
      definition.directives?.map((node) => DirectiveNode.fromDefinition(node))
    );
  }

  static create(
    name: string,
    fields: FieldNode[] = [],
    interfaces?: NamedTypeNode[],
    directives?: DirectiveNode[]
  ): ObjectNode {
    return new ObjectNode(name, fields, interfaces, directives);
  }
}
