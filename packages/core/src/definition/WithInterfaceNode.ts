import { NamedTypeNode as INamedTypeNode, StringValueNode } from "graphql";

import { DirectiveNode } from "./DirectiveNode.js";
import { FieldNode } from "./FieldNode.js";
import { NamedTypeNode } from "./TypeNode.js";
import { WithFieldsNode } from "./WithFieldsNode.js";

export abstract class WithInterfaceNode extends WithFieldsNode {
  interfaces?: NamedTypeNode[];

  constructor(
    name: string,
    description?: StringValueNode,
    directives?: DirectiveNode[],
    fields?: FieldNode[],
    interfaces?: NamedTypeNode[]
  ) {
    super(name, description, directives, fields);

    this.interfaces = interfaces;
  }

  public getInterfaces(): NamedTypeNode[] {
    return this.interfaces ?? [];
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
