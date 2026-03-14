import { describe, it, expect } from "vitest";
import { ConstDirectiveNode, EnumValueDefinitionNode, Kind } from "graphql";
import { EnumValueNode } from "./EnumValueNode";
import { DirectiveNode } from "./DirectiveNode";

const definition = {
  kind: Kind.ENUM_VALUE_DEFINITION,
  name: {
    kind: Kind.NAME,
    value: "name",
  },
  directives: [
    {
      kind: Kind.DIRECTIVE,
      name: {
        kind: Kind.NAME,
        value: "directive1",
      },
    },
  ],
} as const satisfies EnumValueDefinitionNode;

describe("EnumValueNode", () => {
  it("creates node from values", () => {
    const node = EnumValueNode.create("name");
    expect(node.name).toEqual("name");
    expect(node.directives).toBeUndefined();
  });

  it("creates node from definition", () => {
    const node = EnumValueNode.fromDefinition(definition);
    expect(node).toBeInstanceOf(EnumValueNode);
    expect(node.name).toEqual("name");
  });

  it("creates node with directive definition", () => {
    const node = EnumValueNode.create("name", [
      {
        kind: Kind.DIRECTIVE,
        name: {
          kind: Kind.NAME,
          value: "name",
        },
      } as const satisfies ConstDirectiveNode,
    ]);
    expect(node).toBeInstanceOf(EnumValueNode);
    expect(node.name).toEqual("name");
    expect(node.directives).toHaveLength(1);
  });

  it("serializes node to definition", () => {
    const node = EnumValueNode.create("name", [DirectiveNode.create("directive1")]);
    const serialized = node.serialize();
    expect(serialized).toEqual(definition);
  });

  it("checks for directive existence", () => {
    const node = EnumValueNode.create("name", ["value1"]);
    expect(node.hasDirective("directive1")).toBe(false);
  });

  it("adds directive to node", () => {
    const node = EnumValueNode.create("name");
    node
      .addDirective("directive1")
      .addDirective(DirectiveNode.create("directive2"))
      .addDirective({
        kind: Kind.DIRECTIVE,
        name: {
          kind: Kind.NAME,
          value: "directive3",
        },
      } as const satisfies ConstDirectiveNode);
    expect(node.directives).toHaveLength(3);
  });

  it("throws error when adding duplicate directive", () => {
    const node = EnumValueNode.create("name");
    node.addDirective("directive1");
    expect(() => node.addDirective("directive1")).toThrow(
      `Directive directive1 already exists on node name`
    );
  });

  it("gets directive from node", () => {
    const node = EnumValueNode.create("name", ["directive1"]);
    const directive = node.getDirective("directive1");
    expect(directive).toBeInstanceOf(DirectiveNode);
    expect(directive?.name).toEqual("directive1");
  });

  it("removes directive from node", () => {
    const node = EnumValueNode.create("name");
    node.addDirective("directive1");
    expect(node.directives).toHaveLength(1);
    node.removeDirective("directive1");
    expect(node.directives).toHaveLength(0);
  });
});
