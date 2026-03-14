import { describe, it, expect } from "vitest";
import {
  DirectiveLocation,
  DirectiveDefinitionNode as ASTDirectiveDefinitionNode,
  Kind,
} from "graphql";
import { DirectiveDefinitionNode } from "./DirectiveDefinitionNode";
import { InputValueNode } from "./InputValueNode";

const definition = {
  kind: Kind.DIRECTIVE_DEFINITION,
  name: {
    kind: Kind.NAME,
    value: "name",
  },
  locations: [
    {
      kind: Kind.NAME,
      value: DirectiveLocation.FIELD_DEFINITION,
    },
    {
      kind: Kind.NAME,
      value: DirectiveLocation.OBJECT,
    },
  ],
  repeatable: false,
  arguments: [
    {
      kind: Kind.INPUT_VALUE_DEFINITION,
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
    },
  ],
} as const satisfies ASTDirectiveDefinitionNode;

describe("DirectiveDefinitionNode", () => {
  it("creates node from values", () => {
    const node = DirectiveDefinitionNode.create(
      "name",
      "FIELD_DEFINITION",
      InputValueNode.create("name", "String")
    );
    expect(node.name).toEqual("name");
    expect(node.locations).toEqual(["FIELD_DEFINITION"]);
    expect(node.arguments).toBeInstanceOf(Array);
    expect(node.repeatable).toEqual(false);
  });

  it("creates node from definition", () => {
    const node = DirectiveDefinitionNode.fromDefinition(definition);
    expect(node).toBeInstanceOf(DirectiveDefinitionNode);
    expect(node.name).toEqual("name");
    expect(node.locations).toEqual(["FIELD_DEFINITION", "OBJECT"]);
    expect(node.arguments).toBeInstanceOf(Array);
    expect(node.repeatable).toEqual(false);
  });

  it("creates repeatable node from values", () => {
    const node = DirectiveDefinitionNode.create("name", "FIELD_DEFINITION", undefined, true);
    expect(node.repeatable).toEqual(true);
  });

  it("checks if node has argument", () => {
    const node = DirectiveDefinitionNode.create(
      "name",
      "FIELD_DEFINITION",
      InputValueNode.create("name", "String")
    );
    expect(node.hasArgument("name")).toBe(true);
    expect(node.hasArgument("unknown")).toBe(false);
  });

  it("gets argument from node", () => {
    const node = DirectiveDefinitionNode.create("name", "FIELD_DEFINITION", [
      InputValueNode.create("name", "String"),
    ]);
    const arg = node.getArgument("name");
    expect(arg).toBeDefined();
    expect(arg?.name).toBe("name");
  });

  it("adds argument to node", () => {
    const node = DirectiveDefinitionNode.create("name", "FIELD_DEFINITION");
    node.addArgument(InputValueNode.create("newArg", "String"));
    expect(node.hasArgument("newArg")).toBe(true);
  });

  it("adds argument definition to node", () => {
    const node = DirectiveDefinitionNode.create("name", "FIELD_DEFINITION");
    node.addArgument(definition.arguments[0]);
    expect(node.hasArgument("name")).toBe(true);
  });

  it("removes argument from node", () => {
    const node = DirectiveDefinitionNode.create(
      "name",
      "FIELD_DEFINITION",
      InputValueNode.create("name", "String")
    );
    node.removeArgument("name");
    expect(node.hasArgument("name")).toBe(false);
  });

  it("throws error when adding duplicate argument", () => {
    const node = DirectiveDefinitionNode.create(
      "name",
      "FIELD_DEFINITION",
      InputValueNode.create("name", "String")
    );
    expect(() => {
      node.addArgument(InputValueNode.create("name", "String"));
    }).toThrow();
  });

  it("serializes node to definition", () => {
    const node = DirectiveDefinitionNode.create(
      "name",
      ["FIELD_DEFINITION", "OBJECT"],
      [InputValueNode.create("name", "String")],
      false
    );
    const serialized = node.serialize();
    expect(serialized).toEqual(definition);
  });
});
