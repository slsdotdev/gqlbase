import { describe, it, expect } from "vitest";
import { FieldDefinitionNode, Kind, ObjectTypeDefinitionNode } from "graphql";
import { FieldNode } from "./FieldNode.js";
import { NamedTypeNode, NonNullTypeNode } from "./TypeNode.js";
import { WithFieldsNode } from "./WithFieldsNode.js";

class TestNode extends WithFieldsNode {
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
    };
  }
}

describe("WithFieldsNode", () => {
  it("checks for field existance", () => {
    const node = new TestNode("WithFields");
    expect(node.hasField("field1")).toBe(false);
  });

  it("gets field from node", () => {
    const node = new TestNode("WithFields", undefined, undefined, [
      FieldNode.create("name", undefined, undefined, NamedTypeNode.create("String")),
    ]);

    const nameField = node.getField("name");
    expect(nameField).toBeInstanceOf(FieldNode);
  });

  it("returns undefined when field not found", () => {
    const node = new TestNode("WithFields", undefined, undefined, [
      FieldNode.create("name", undefined, undefined, NamedTypeNode.create("String")),
    ]);

    const emailField = node.getField("email");
    expect(emailField).toBeUndefined();
  });

  it("adds fields to node", () => {
    const node = new TestNode("WithFields");
    node
      .addField(FieldNode.create("name", undefined, undefined, NamedTypeNode.create("String")))
      .addField({
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
    const node = new TestNode("Test", undefined, undefined, [
      FieldNode.create("name", undefined, undefined, NamedTypeNode.create("String")),
    ]);

    expect(() => {
      node.addField(
        FieldNode.create("name", undefined, undefined, NonNullTypeNode.create("String"))
      );
    }).toThrow(`Field name already exists on node Test`);
  });

  it("removes field from node", () => {
    const node = new TestNode("WithFields");
    node.addField(FieldNode.create("name", undefined, undefined, NamedTypeNode.create("String")));
    expect(node.fields).toHaveLength(1);
    node.removeField("name");
    expect(node.fields).toHaveLength(0);
  });
});
