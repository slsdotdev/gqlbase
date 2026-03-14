import { InterfaceTypeDefinitionNode, InterfaceTypeExtensionNode, Kind } from "graphql";
import { WithInterfaceNode } from "./WithInterfaceNode";
import { FieldNode } from "./FieldNode";
import { DirectiveNode } from "./DirectiveNode";
import { NamedTypeNode } from "./TypeNode";

export class InterfaceNode extends WithInterfaceNode {
  kind: Kind.INTERFACE_TYPE_DEFINITION = Kind.INTERFACE_TYPE_DEFINITION;
  name: string;
  fields?: FieldNode[] | undefined;
  interfaces?: NamedTypeNode[] | undefined;
  directives?: DirectiveNode[] | undefined;

  constructor(
    name: string,
    fields?: FieldNode[],
    interfaces?: NamedTypeNode[],
    directives?: DirectiveNode[]
  ) {
    super(name, fields, interfaces, directives);
    this.name = name;
    this.fields = fields ?? undefined;
    this.interfaces = interfaces ?? undefined;
    this.directives = directives ?? undefined;
  }

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
      fields: this.fields?.map((node) => node.serialize()),
      interfaces: this.interfaces?.map((node) => node.serialize()),
      directives: this.directives?.map((node) => node.serialize()),
    };
  }

  static fromDefinition(definition: InterfaceTypeDefinitionNode) {
    return new InterfaceNode(
      definition.name.value,
      definition.fields?.map((field) => FieldNode.fromDefinition(field)),
      definition.interfaces?.map((node) => NamedTypeNode.fromDefinition(node)),
      definition.directives?.map((directive) => DirectiveNode.fromDefinition(directive))
    );
  }

  static create(
    name: string,
    fields?: FieldNode[],
    interfaces?: NamedTypeNode[],
    directives?: DirectiveNode[]
  ): InterfaceNode {
    return new InterfaceNode(name, fields, interfaces, directives);
  }
}
