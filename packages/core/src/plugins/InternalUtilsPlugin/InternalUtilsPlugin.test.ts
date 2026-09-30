import { beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "../../context/index.js";
import { DocumentNode, ScalarNode } from "../../definition/index.js";
import { createTransformer } from "../../transformer/index.js";
import { InternalUtilsPlugin } from "./InternalUtilsPlugin.js";
import { getTypeHint, TypeHintValue } from "./InternalUtilsPlugin.utils.js";

describe("InternalUtilsPlugin", () => {
  describe("@gqlbase_typehint", () => {
    let context: TransformerContext;
    let plugin: InternalUtilsPlugin;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new InternalUtilsPlugin(context);
      context.registerPlugin(plugin);
    });

    it.each(Object.values(TypeHintValue))("accepts the enum value %s", (value) => {
      context.finishWork();
      context.startWork(DocumentNode.fromSource(`scalar Custom @gqlbase_typehint(type: ${value})`));

      const scalar = context.document.getNodeOrThrow("Custom") as ScalarNode;

      expect(() => plugin.normalize(scalar)).not.toThrow();
      expect(getTypeHint(scalar)).toBe(value);
    });

    it("rejects a string literal", () => {
      context.finishWork();
      context.startWork(DocumentNode.fromSource(`scalar Custom @gqlbase_typehint(type: "string")`));

      const scalar = context.document.getNodeOrThrow("Custom") as ScalarNode;

      expect(() => plugin.normalize(scalar)).toThrow(/not `type: "string"`/);
    });

    it("rejects an unknown enum value", () => {
      context.finishWork();
      context.startWork(DocumentNode.fromSource(`scalar Custom @gqlbase_typehint(type: strng)`));

      const scalar = context.document.getNodeOrThrow("Custom") as ScalarNode;

      expect(() => plugin.normalize(scalar)).toThrow(/"type" must be one of the enum values/);
    });

    it("returns unknown for a scalar without a hint", () => {
      context.finishWork();
      context.startWork(DocumentNode.fromSource(`scalar Custom`));

      expect(getTypeHint(context.document.getNodeOrThrow("Custom") as ScalarNode)).toBe("unknown");
    });
  });

  describe("in a transform", () => {
    it("fails on a string literal type hint", () => {
      expect(() =>
        createTransformer().transform(/* GraphQL */ `
          scalar Money @gqlbase_typehint(type: "number")

          type Query {
            price: Money
          }
        `)
      ).toThrow(/Invalid @gqlbase_typehint on scalar Money/);
    });
  });
});
