import { describe, it, expect } from "vitest";
import { Kind } from "graphql";
import { ValueNode } from "./ValueNode.js";

describe("ValueNode", () => {
  it("creates string", () => {
    const node = ValueNode.string("string");
    expect(node).toEqual({
      kind: Kind.STRING,
      value: "string",
    });
  });
  it("creates int", () => {
    const node = ValueNode.int(1);
    expect(node).toEqual({
      kind: Kind.INT,
      value: "1",
    });
  });
  it("creates float", () => {
    const node = ValueNode.float(1.2);
    expect(node).toEqual({
      kind: Kind.FLOAT,
      value: "1.2",
    });
  });

  it("creates boolean", () => {
    const node = ValueNode.boolean(true);
    expect(node).toEqual({
      kind: Kind.BOOLEAN,
      value: true,
    });
  });

  it("creates null", () => {
    const node = ValueNode.null();
    expect(node).toEqual({
      kind: Kind.NULL,
    });
  });

  it("creates enum", () => {
    const node = ValueNode.enum("STRING");
    expect(node).toEqual({
      kind: Kind.ENUM,
      value: "STRING",
    });
  });

  it("creates list", () => {
    const node = ValueNode.list([ValueNode.string("1"), ValueNode.int(2)]);
    expect(node).toEqual({
      kind: Kind.LIST,
      values: [
        { kind: Kind.STRING, value: "1" },
        { kind: Kind.INT, value: "2" },
      ],
    });
  });

  it("creates object", () => {
    const node = ValueNode.object({
      string: ValueNode.string("1"),
      int: ValueNode.int(2),
    });

    expect(node).toEqual(
      expect.objectContaining({
        kind: Kind.OBJECT,
      })
    );
  });

  it("parsed value", () => {
    const node = ValueNode.fromValue({
      stirng: "string",
      int: 1,
      float: 2.1,
      boolean: true,
      null: null,
      list: ["3", 4, false],
      object: {
        type: "object",
      },
    });

    expect(node).toEqual(
      expect.objectContaining({
        kind: Kind.OBJECT,
      })
    );
  });

  it("return object value", () => {
    const value = ValueNode.getValue(
      ValueNode.fromValue({
        stirng: "string",
        int: 1,
        float: 2.1,
        boolean: true,
        null: null,
        list: ["3", 4, false],
        object: {
          type: "object",
        },
      })
    );

    expect(value).toEqual(
      expect.objectContaining({
        stirng: "string",
        int: 1,
        float: 2.1,
        boolean: true,
        null: null,
        list: ["3", 4, false],
        object: {
          type: "object",
        },
      })
    );
  });

  it("gets value from enum", () => {
    const value = ValueNode.getValue({
      kind: Kind.ENUM,
      value: "ENUM",
    });

    expect(value).toEqual("ENUM");
  });
});
