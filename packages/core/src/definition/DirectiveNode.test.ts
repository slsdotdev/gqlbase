import { describe, it, expect } from "vitest";
import { Kind } from "graphql";
import { DirectiveNode } from "./DirectiveNode";
import { ArgumentNode } from "./ArgumentNode";
import { ValueNode } from "./ValueNode";

describe("DirectiveNode", () => {
  it("creates node from values", () => {
    const node = DirectiveNode.create("name");
    expect(node.name).toEqual("name");
    expect(node.arguments).toBeUndefined();
  });

  it("creates node from definition", () => {
    const node = DirectiveNode.fromDefinition({
      kind: Kind.DIRECTIVE,
      name: {
        kind: Kind.NAME,
        value: "name",
      },
      arguments: [],
    });
    expect(node).toBeInstanceOf(DirectiveNode);
    expect(node.name).toEqual("name");
    expect(node.arguments).toBeInstanceOf(Array);
  });

  it("serializes node to definition", () => {
    const node = DirectiveNode.create("name");
    const serialized = node.serialize();
    expect(serialized).toEqual({
      kind: Kind.DIRECTIVE,
      name: {
        kind: Kind.NAME,
        value: "name",
      },
      arguments: undefined,
    });
  });

  it("adds argument to node", () => {
    const node = DirectiveNode.create("name");
    const argument = ArgumentNode.create("arg", ValueNode.string("value"));
    node.addArgument(argument);
    expect(node.arguments).toHaveLength(1);
  });

  it("adds argument to node with definition", () => {
    const node = DirectiveNode.create("name");
    const argument = ArgumentNode.create("arg", ValueNode.string("value"));
    node.addArgument(argument.serialize());
    expect(node.arguments).toHaveLength(1);
  });

  it("throws error when adding duplicate argument", () => {
    const node = DirectiveNode.create("name");
    const argument = ArgumentNode.create("arg", ValueNode.string("value"));
    node.addArgument(argument);
    expect(() => node.addArgument(argument)).toThrow(
      `Argument ${argument.name} already exists on field ${node.name}`
    );
  });

  it("removes argument from node", () => {
    const node = DirectiveNode.create("name");
    const argument = ArgumentNode.create("arg", ValueNode.string("value"));
    node.addArgument(argument);
    expect(node.arguments).toHaveLength(1);
    node.removeArgument("arg");
    expect(node.arguments).toHaveLength(0);
  });
  it("checks if node has argument", () => {
    const node = DirectiveNode.create("name");
    const argument = ArgumentNode.create("arg", ValueNode.string("value"));
    node.addArgument(argument);
    expect(node.hasArgument("arg")).toBe(true);
    expect(node.hasArgument("unknown")).toBe(false);
  });
  it("gets argument from node", () => {
    const node = DirectiveNode.create("name");
    const argument = ArgumentNode.create("arg", ValueNode.string("value"));
    node.addArgument(argument);
    const arg = node.getArgument("arg");
    expect(arg).toBeDefined();
    expect(arg?.name).toBe("arg");
  });
  it("gets arguments JSON", () => {
    const node = DirectiveNode.create("name");
    const argument = ArgumentNode.create("arg", ValueNode.string("value"));
    node.addArgument(argument);
    const json = node.getArgumentsJSON();
    expect(json).toEqual({ arg: "value" });
  });

  it("returns empty object for no arguments JSON", () => {
    const node = DirectiveNode.create("name");
    const json = node.getArgumentsJSON();
    expect(json).toEqual({});
  });
});
