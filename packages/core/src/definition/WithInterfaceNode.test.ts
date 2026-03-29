import { describe, it, expect } from "vitest";
import { NamedTypeNode as INamedTypeNode, Kind, ObjectTypeDefinitionNode } from "graphql";
import { NamedTypeNode } from "./TypeNode.js";
import { WithInterfaceNode } from "./WithInterfaceNode.js";

class TestNode extends WithInterfaceNode {
  kind: Kind.OBJECT_TYPE_DEFINITION = Kind.OBJECT_TYPE_DEFINITION;

  serialize(): ObjectTypeDefinitionNode {
    return {
      kind: this.kind,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      directives: this.directives?.map((node) => node.serialize()),
      fields: this.fields?.map((node) => node.serialize()),
      interfaces: this.interfaces?.map((node) => node.serialize()),
    };
  }
}

describe("WithInterfaceNode", () => {
  it("checks for interface existance", () => {
    const node = new TestNode("TestInterface");
    expect(node.hasInterface("field1")).toBe(false);
  });

  it("returns undefined when interface not found", () => {
    const node = new TestNode("TestInterface");

    const nodeIface = node.getField("Node");
    expect(nodeIface).toBeUndefined();
  });

  it("adds interface to node", () => {
    const node = new TestNode("TestInterface");
    node
      .addInterface("Node")
      .addInterface(NamedTypeNode.create("Node2"))
      .addInterface({
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "Node3",
        },
      } as const satisfies INamedTypeNode);

    expect(node.interfaces).toHaveLength(3);
  });

  it("throws error when adding duplicate field", () => {
    const node = new TestNode("TestInterface", undefined, undefined, undefined, [
      NamedTypeNode.create("Node"),
    ]);

    expect(() => {
      node.addInterface(NamedTypeNode.create("Node"));
    }).toThrow(`Interface Node already exists on node TestInterface`);
  });

  it("removes field from node", () => {
    const node = new TestNode("TestInterface", undefined, undefined, undefined, [
      NamedTypeNode.create("Node"),
    ]);

    expect(node.interfaces).toHaveLength(1);
    node.removeInterface("Node");
    expect(node.interfaces).toHaveLength(0);
  });
});
