import { describe, it, expect } from "vitest";
import { FieldDefinitionNode, Kind } from "graphql";
import { FieldNode } from "./FieldNode";
import { NamedTypeNode, NonNullTypeNode } from "./TypeNode";
import { WithFieldsNode } from "./WithFieldsNode";

describe("WithFieldsNode", () => {
  it("checks for field existance", () => {
    const node = new WithFieldsNode("WithDirectives");
    expect(node.hasField("field1")).toBe(false);
  });

  it("gets field from node", () => {
    const node = new WithFieldsNode("WithDirectives", [
      FieldNode.create("name", NamedTypeNode.create("String")),
    ]);

    const nameField = node.getField("name");
    expect(nameField).toBeInstanceOf(FieldNode);
  });

  it("returns undefined when field not found", () => {
    const node = new WithFieldsNode("WithDirectives", [
      FieldNode.create("name", NamedTypeNode.create("String")),
    ]);

    const emailField = node.getField("email");
    expect(emailField).toBeUndefined();
  });

  it("adds fields to node", () => {
    const node = new WithFieldsNode("WithDirectives");
    node.addField(FieldNode.create("name", NamedTypeNode.create("String"))).addField({
      kind: Kind.FIELD_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "email",
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "String",
        },
      },
    } as const satisfies FieldDefinitionNode);

    expect(node.fields).toHaveLength(2);
  });

  it("throws error when adding duplicate field", () => {
    const node = new WithFieldsNode("Test", [
      FieldNode.create("name", NamedTypeNode.create("String")),
    ]);

    expect(() => {
      node.addField(FieldNode.create("name", NonNullTypeNode.create("String")));
    }).toThrow(`Field name already exists on node Test`);
  });

  it("removes field from node", () => {
    const node = new WithFieldsNode("WithDirectives");
    node.addField(FieldNode.create("name", NamedTypeNode.create("String")));
    expect(node.fields).toHaveLength(1);
    node.removeField("name");
    expect(node.fields).toHaveLength(0);
  });
});
