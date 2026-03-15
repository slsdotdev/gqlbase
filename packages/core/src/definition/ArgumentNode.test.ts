import { describe, it, expect } from "vitest";
import { ConstArgumentNode, Kind } from "graphql";
import { ArgumentNode } from "./ArgumentNode.js";
import { ValueNode } from "./ValueNode.js";

const definition = {
  kind: Kind.ARGUMENT,
  name: {
    kind: Kind.NAME,
    value: "name",
  },
  value: {
    kind: Kind.STRING,
    value: "value",
  },
} as const satisfies ConstArgumentNode;

describe("ArgumentNode", () => {
  it("creates node from values", () => {
    const node = ArgumentNode.create("name", ValueNode.string("value"));
    expect(node.name).toBe("name");
    expect(node.value).toBeInstanceOf(Object);
  });

  it("creates node from definition", () => {
    const node = ArgumentNode.fromDefinition(definition);
    expect(node).toBeInstanceOf(ArgumentNode);
    expect(node.name).toBe("name");
    expect(node.value).toBeInstanceOf(Object);
  });

  it("serializes node to definition", () => {
    const node = ArgumentNode.create("name", ValueNode.string("value"));
    const serialized = node.serialize();
    expect(serialized).toEqual(definition);
  });

  it("converts node to JSON", () => {
    const node = ArgumentNode.create("name", ValueNode.string("value"));
    const json = node.toJSON();
    expect(json).toEqual({ name: "value" });
  });
});
