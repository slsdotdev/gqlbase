import { describe, it, expect } from "vitest";
import {
  ConstDirectiveNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  Kind,
} from "graphql";
import { EnumNode } from "./EnumNode.js";
import { DirectiveNode } from "./DirectiveNode.js";
import { EnumValueNode } from "./EnumValueNode.js";

const definition = {
  kind: Kind.ENUM_TYPE_DEFINITION,
  name: {
    kind: Kind.NAME,
    value: "name",
  },
  values: [
    {
      kind: Kind.ENUM_VALUE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "value1",
      },
    },
    {
      kind: Kind.ENUM_VALUE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "value2",
      },
    },
  ],
  directives: [
    {
      kind: Kind.DIRECTIVE,
      name: {
        kind: Kind.NAME,
        value: "directive1",
      },
    },
  ],
} as const satisfies EnumTypeDefinitionNode;

describe("EnumNode", () => {
  it("creates node from values", () => {
    const node = EnumNode.create(
      "name",
      undefined,
      [DirectiveNode.create("directive1")],
      ["value1", "value2"]
    );
    expect(node.name).toEqual("name");
    expect(node.values).toBeInstanceOf(Array);
    expect(node.values?.length).toEqual(2);
    expect(node.directives).toBeInstanceOf(Array);
  });

  it("creates node from definition", () => {
    const node = EnumNode.fromDefinition(definition);
    expect(node).toBeInstanceOf(EnumNode);
    expect(node.name).toEqual("name");
    expect(node.values).toBeInstanceOf(Array);
    expect(node.values?.length).toEqual(2);
  });

  it("creates node from definition with no values", () => {
    const node = EnumNode.fromDefinition({
      kind: Kind.ENUM_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "name",
      },
    } as const satisfies EnumTypeDefinitionNode);
    expect(node).toBeInstanceOf(EnumNode);
    expect(node.name).toEqual("name");
    expect(node.values).toBeUndefined();
  });

  it("serializes node to definition", () => {
    const node = EnumNode.create("name", undefined, undefined, ["value1", "value2"]);
    const serialized = node.serialize();
    expect(serialized.kind).toEqual(Kind.ENUM_TYPE_DEFINITION);
  });

  it("checks for value existence", () => {
    const node = EnumNode.create("name", undefined, undefined, ["value1", "value2"]);
    expect(node.hasValue("value1")).toBe(true);
    expect(node.hasValue("value3")).toBe(false);
  });

  it("checks for value existance when no values", () => {
    const node = EnumNode.create("name");
    expect(node.hasValue("value1")).toBe(false);
    expect(node.hasValue("value3")).toBe(false);
  });

  it("adds value to node when no values", () => {
    const node = EnumNode.create("name");
    node.addValue("value1");
    expect(node.values).toHaveLength(1);
  });

  it("adds value to node", () => {
    const node = EnumNode.create("name", undefined, undefined, ["value1"]);
    node
      .addValue("value2")
      .addValue(EnumValueNode.create("value3"))
      .addValue({
        kind: Kind.ENUM_VALUE_DEFINITION,
        name: {
          kind: Kind.NAME,
          value: "value4",
        },
      } as const satisfies EnumValueDefinitionNode);
    expect(node.values).toHaveLength(4);
  });

  it("throws error when adding duplicate value", () => {
    const node = EnumNode.create("name", undefined, undefined, ["value1"]);
    expect(() => node.addValue("value1")).toThrow(`Value value1 already exists on enum name`);
  });

  it("removes value from node", () => {
    const node = EnumNode.create("name", undefined, undefined, ["value1", "value2"]);
    node.removeValue("value1");
    expect(node.values).toHaveLength(1);
  });

  it("checks for directive existence", () => {
    const node = EnumNode.create("name", undefined, undefined, ["value1"]);
    expect(node.hasDirective("directive1")).toBe(false);
  });

  it("adds directive to node", () => {
    const node = EnumNode.create("name");
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
    const node = EnumNode.create("name");
    node.addDirective("directive1");
    expect(() => node.addDirective("directive1")).toThrow(
      `Directive directive1 already exists on node name`
    );
  });

  it("removes directive from node", () => {
    const node = EnumNode.create("name", undefined, undefined, ["value1"]);
    node.addDirective("directive1");
    expect(node.directives).toHaveLength(1);
    node.removeDirective("directive1");
    expect(node.directives).toHaveLength(0);
  });

  it("extends node with definition", () => {
    const node = EnumNode.create("name", undefined, undefined, ["value1"]);
    const definition = {
      kind: Kind.ENUM_TYPE_EXTENSION,
      name: {
        kind: Kind.NAME,
        value: "name",
      },
      values: [
        {
          kind: Kind.ENUM_VALUE_DEFINITION,
          name: {
            kind: Kind.NAME,
            value: "value2",
          },
        },
      ],
      directives: [
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: "directive1",
          },
        },
      ],
    } as const satisfies EnumTypeExtensionNode;

    node.extend(definition);
    expect(node.values).toHaveLength(2);
  });
});
