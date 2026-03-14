import { describe, it, expect } from "vitest";
import { FieldDefinitionNode, InputValueDefinitionNode, Kind } from "graphql";
import { FieldNode } from "./FieldNode";
import { NamedTypeNode, NonNullTypeNode } from "./TypeNode";
import { InputValueNode } from "./InputValueNode";
import { DirectiveNode } from "./DirectiveNode";

const fieldDefinition = {
  kind: Kind.FIELD_DEFINITION,
  name: {
    kind: Kind.NAME,
    value: "name",
  },
  type: {
    kind: Kind.NAMED_TYPE,
    name: {
      kind: Kind.NAME,
      value: "String",
    },
  },
} as const satisfies FieldDefinitionNode;

describe("FieldNode", () => {
  it("creates node from values", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"));
    expect(node.name).toEqual("name");
    expect(node.arguments).toBeUndefined();
    expect(node.directives).toBeUndefined();
  });

  it("creates node from definition", () => {
    const node = FieldNode.fromDefinition(fieldDefinition);
    expect(node).toBeInstanceOf(FieldNode);
    expect(node.name).toEqual("name");
  });

  it("creates node with argument definition", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"), [
      InputValueNode.create("name", "String"),
    ]);
    expect(node).toBeInstanceOf(FieldNode);
    expect(node.name).toEqual("name");
    expect(node.arguments).toHaveLength(1);
  });

  it("creates node with directive definition", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"), undefined, [
      DirectiveNode.create("directive1"),
    ]);
    expect(node).toBeInstanceOf(FieldNode);
    expect(node.name).toEqual("name");
    expect(node.directives).toHaveLength(1);
  });

  it("sets node type", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"));
    node.setType(NonNullTypeNode.create("String"));
    expect(node.type).toBeInstanceOf(NonNullTypeNode);
  });

  it("serializes node to definition", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"));
    const serialized = node.serialize();
    expect(serialized).toEqual(fieldDefinition);
  });

  it("checks for argument existence", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"), [
      InputValueNode.create("name", "String"),
    ]);
    expect(node.hasArgument("name")).toBe(true);
    expect(node.hasArgument("nonexistent")).toBe(false);
  });

  it("adds argument to node", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"));
    node.addArgument(InputValueNode.create("first", "String")).addArgument({
      kind: Kind.INPUT_VALUE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "second",
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "Int",
        },
      },
    } as const satisfies InputValueDefinitionNode);
    expect(node.arguments).toHaveLength(2);
  });

  it("throws error when adding duplicate argument", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"));
    const argument = InputValueNode.create("name", "String");
    node.addArgument(argument);
    expect(() => node.addArgument(argument)).toThrow(
      `Argument ${argument.name} already exists on field ${node.name}`
    );
  });

  it("removes argument from node", () => {
    const node = FieldNode.create("name", NamedTypeNode.create("String"));
    const argument = InputValueNode.create("name", "String");
    node.addArgument(argument);
    expect(node.arguments).toHaveLength(1);
    node.removeArgument("name");
    expect(node.arguments).toHaveLength(0);
  });
});
