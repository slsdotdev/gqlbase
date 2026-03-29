import { describe, it, expect } from "vitest";
import { Kind, ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from "graphql";
import { DirectiveNode } from "./DirectiveNode.js";
import { FieldNode } from "./FieldNode.js";
import { ObjectNode } from "./ObjectNode.js";
import { NamedTypeNode } from "./TypeNode.js";

const definition = {
  kind: Kind.OBJECT_TYPE_DEFINITION,
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
} as const satisfies ObjectTypeDefinitionNode;

describe("ObjectNode", () => {
  it("creates node from values", () => {
    const node = ObjectNode.create(
      "Test",
      undefined,
      [DirectiveNode.create("auth")],
      [FieldNode.create("id", undefined, undefined, NamedTypeNode.create("ID"))],
      [NamedTypeNode.create("Node")]
    );

    expect(node).toBeInstanceOf(ObjectNode);
    expect(node.name).toEqual("Test");
  });

  it("creates node from definition", () => {
    const node = ObjectNode.fromDefinition(definition);

    expect(node).toBeInstanceOf(ObjectNode);
    expect(node.name).toEqual("Test");
  });

  it("extends interface", () => {
    const node = ObjectNode.create("Test");

    node.extend({
      ...definition,
      kind: Kind.OBJECT_TYPE_EXTENSION,
    } as const satisfies ObjectTypeExtensionNode);

    expect(node.hasField("id")).toEqual(true);
    expect(node.hasInterface("Node")).toEqual(true);
    expect(node.hasDirective("auth")).toEqual(true);
  });

  it("serializes node", () => {
    const node = ObjectNode.create(
      "Test",
      undefined,
      [DirectiveNode.create("auth")],
      [FieldNode.create("id", undefined, undefined, NamedTypeNode.create("ID"))],
      [NamedTypeNode.create("Node")]
    );

    const serializedDefinition = node.serialize();
    expect(serializedDefinition).toEqual(expect.objectContaining(definition));
  });
});
