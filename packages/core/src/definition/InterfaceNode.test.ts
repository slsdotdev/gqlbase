import { describe, it, expect } from "vitest";
import { InterfaceTypeDefinitionNode, InterfaceTypeExtensionNode, Kind } from "graphql";
import { DirectiveNode } from "./DirectiveNode";
import { FieldNode } from "./FieldNode";
import { InterfaceNode } from "./InterfaceNode";
import { NamedTypeNode } from "./TypeNode";

const definition = {
  kind: Kind.INTERFACE_TYPE_DEFINITION,
  name: {
    kind: Kind.NAME,
    value: "Test",
  },
  fields: [
    {
      kind: Kind.FIELD_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "id",
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "ID",
        },
      },
    },
  ],
  interfaces: [
    {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: "Node",
      },
    },
  ],
  directives: [
    {
      kind: Kind.DIRECTIVE,
      name: {
        kind: Kind.NAME,
        value: "auth",
      },
    },
  ],
} as const satisfies InterfaceTypeDefinitionNode;

describe("InterfaceNode", () => {
  it("creates node from values", () => {
    const node = InterfaceNode.create(
      "Test",
      [FieldNode.create("id", NamedTypeNode.create("ID"))],
      undefined,
      [DirectiveNode.create("exampleDirective")]
    );

    expect(node).toBeInstanceOf(InterfaceNode);
    expect(node.name).toEqual("Test");
  });

  it("creates node from definition", () => {
    const node = InterfaceNode.fromDefinition(definition);

    expect(node).toBeInstanceOf(InterfaceNode);
    expect(node.name).toEqual("Test");
  });

  it("extends interface", () => {
    const node = InterfaceNode.create("Test");

    node.extend({
      ...definition,
      kind: Kind.INTERFACE_TYPE_EXTENSION,
    } as const satisfies InterfaceTypeExtensionNode);

    expect(node.hasField("id")).toEqual(true);
    expect(node.hasInterface("Node")).toEqual(true);
    expect(node.hasDirective("auth")).toEqual(true);
  });

  it("serializes node", () => {
    const node = InterfaceNode.create(
      "Test",
      [FieldNode.create("id", NamedTypeNode.create("ID"))],
      [NamedTypeNode.create("Node")],
      [DirectiveNode.create("auth")]
    );

    const serializedDefinition = node.serialize();
    expect(serializedDefinition).toEqual(expect.objectContaining(definition));
  });
});
