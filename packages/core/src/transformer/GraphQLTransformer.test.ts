import { beforeEach, describe, expect, it, vi } from "vitest";
import { GraphQLTransformer } from "./GraphQLTransformer";
import { TransformerContext } from "../context/TransformerContext";
import { Logger } from "@gqlbase/shared/logger";
import { ITransformerPlugin } from "../plugins";
import { DefinitionNode } from "../definition";

const mockLogger = vi.mockObject(Logger.prototype);
const testPlugin: ITransformerPlugin = {
  name: "TestPlugin",
  init: vi.fn(),
  match: vi.fn().mockReturnValue(true),
  normalize: vi.fn(),
  execute: vi.fn(),
  cleanup: vi.fn(),
  generate: vi.fn(),
};

describe("GraphQLTransformer", () => {
  let transformer: GraphQLTransformer;
  let context: TransformerContext;

  beforeEach(() => {
    context = new TransformerContext();
    context.registerPlugin(testPlugin);

    transformer = new GraphQLTransformer(context, { logger: mockLogger, throwOnError: true });
  });

  it("should throw error on schema with duplicate definition", () => {
    const invalidSource = /* GraphQL */ `
      type Query {
        hello: String
      }

      type Query {
        world: String
      }
    `;

    expect(() => transformer.transform(invalidSource)).toThrow();
  });

  it("should throw error on invalid schema with missing references", () => {
    const invalidSource = /* GraphQL */ `
      type Query {
        user: User
      }
    `;

    expect(() => transformer.transform(invalidSource)).toThrow("Schema validation failed");
  });

  it("should not throw when `throwOnError` is false", () => {
    const transformerWithNoThrow = new GraphQLTransformer(context, {
      logger: mockLogger,
      throwOnError: false,
    });

    const invalidSource = /* GraphQL */ `
      type Query {
        user: User
      }
    `;

    expect(() => transformerWithNoThrow.transform(invalidSource)).not.toThrow();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Schema validation failed")
    );
  });

  it("should transform schema", () => {
    const source = /* GraphQL */ `
      type Query {
        user: User
      }

      type User {
        id: ID
        name: String
      }
    `;

    const output = transformer.transform(source);
    expect(testPlugin.match).toHaveBeenCalledTimes(6);
    expect(testPlugin.normalize).toHaveBeenCalledTimes(2);
    expect(testPlugin.execute).toHaveBeenCalledTimes(2);
    expect(testPlugin.cleanup).toHaveBeenCalledTimes(2);
    expect(testPlugin.generate).toHaveBeenCalledTimes(1);
    expect(output.schema).toContain("type Query");
  });

  it("should prevent execution when definition does not match plugin", () => {
    const nonMatchingPlugin: ITransformerPlugin = {
      name: "NonMatchingPlugin",
      init: vi.fn(),
      match: vi.fn().mockImplementation((node: DefinitionNode) => node.name !== "User"),
      normalize: vi.fn(),
      execute: vi.fn(),
    };

    const context = new TransformerContext();
    context.registerPlugin(nonMatchingPlugin);
    const transformer = new GraphQLTransformer(context, { logger: mockLogger, throwOnError: true });

    const source = /* GraphQL */ `
      type Query {
        user: User
      }

      type User {
        id: ID
        name: String
      }
    `;

    transformer.transform(source);

    expect(nonMatchingPlugin.match).toHaveBeenCalledTimes(6);
    expect(nonMatchingPlugin.normalize).toHaveBeenCalledTimes(1);
    expect(nonMatchingPlugin.execute).toHaveBeenCalledTimes(1);
  });
});
