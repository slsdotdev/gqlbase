import { describe, it, expect } from "vitest";
import { Kind } from "graphql";
import { NamedTypeNode } from "./TypeNode.js";
import { UnionNode } from "./UnionNode.js";
import { DirectiveNode } from "./DirectiveNode.js";

describe("UnionNode", () => {
  it("creates node from values", () => {
    const node = UnionNode.create(
      "Union",
      ["Test", NamedTypeNode.create("Test2")],
      [DirectiveNode.create("testOnly")]
    );
    expect(node).toBeInstanceOf(UnionNode);
    expect(node.types).toHaveLength(2);
  });

  it("creates node from definition", () => {
    const node = UnionNode.fromDefinition({
      kind: Kind.UNION_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "Union",
      },
      types: [
        {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "Test",
          },
        },
        {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "Test2",
          },
        },
      ],
      directives: [
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: "testOnly",
          },
        },
      ],
    });

    expect(node).toBeInstanceOf(UnionNode);
    expect(node.types).toHaveLength(2);
  });

  it("extends node", () => {
    const node = UnionNode.create("Union", ["Test"]);
    node.extend({
      kind: Kind.UNION_TYPE_EXTENSION,
      name: {
        kind: Kind.NAME,
        value: "Union",
      },
      types: [
        {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "Test2",
          },
        },
      ],
      directives: [
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: "testOnly",
          },
        },
      ],
    });

    expect(node).toBeInstanceOf(UnionNode);
    expect(node.types).toHaveLength(2);
  });

  it("serialises node", () => {
    const node = UnionNode.create(
      "Union",
      [NamedTypeNode.create("Test"), NamedTypeNode.create("Test2")],
      [DirectiveNode.create("testOnly")]
    );

    expect(node.serialize()).toEqual({
      kind: Kind.UNION_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "Union",
      },
      types: [
        {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "Test",
          },
        },
        {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "Test2",
          },
        },
      ],
      directives: [
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: "testOnly",
          },
        },
      ],
    });
  });

  it("checks for type existance", () => {
    const node = UnionNode.create("Union");
    expect(node.hasType("Test")).toBe(false);
  });

  it("adds type to node", () => {
    const node = UnionNode.create("Union");
    node
      .addType("test")
      .addType(NamedTypeNode.create("Tes2"))
      .addType({
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "String",
        },
      });

    expect(node.types).toHaveLength(3);
  });

  it("throws error when adding duplicate field", () => {
    const node = UnionNode.create("Union", [NamedTypeNode.create("Test")]);

    expect(() => {
      node.addType(NamedTypeNode.create("Test"));
    }).toThrow(`Type Test already exists on union Union`);
  });

  it("removes field from node", () => {
    const node = UnionNode.create("Union", [NamedTypeNode.create("Test")]);

    expect(node.hasType("Test")).toEqual(true);
    node.removeType("Test");
    expect(node.hasType("Test")).toEqual(false);
  });
});
