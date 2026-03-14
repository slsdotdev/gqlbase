import { NamedTypeNode as INamedTypeNode } from "graphql";

import { DirectiveNode } from "./DirectiveNode";
import { FieldNode } from "./FieldNode";
import { NamedTypeNode } from "./TypeNode";
import { WithFieldsNode } from "./WithFieldsNode";

export class WithInterfaceNode extends WithFieldsNode {
  name: string;
  interfaces?: NamedTypeNode[];

  constructor(
    name: string,
    fields?: FieldNode[],
    interfaces?: NamedTypeNode[],
    directives?: DirectiveNode[]
  ) {
    super(name, fields, directives);
    this.name = name;
    this.interfaces = interfaces;
  }

  public hasInterface(name: string): boolean {
    return this.interfaces?.some((iface) => iface.name === name) ?? false;
  }

  public addInterface(iface: string | NamedTypeNode | INamedTypeNode) {
    const node =
      iface instanceof NamedTypeNode
        ? iface
        : typeof iface === "string"
          ? NamedTypeNode.create(iface)
          : NamedTypeNode.fromDefinition(iface);

    if (this.hasInterface(node.name)) {
      throw new Error(`Interface ${node.name} already exists on node ${this.name}`);
    }
    this.interfaces = this.interfaces ?? [];
    this.interfaces.push(node);

    return this;
  }

  public removeInterface(name: string) {
    this.interfaces = this.interfaces?.filter((iface) => iface.name !== name);
    return this;
  }
}
