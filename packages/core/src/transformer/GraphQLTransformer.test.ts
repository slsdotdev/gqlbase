import { beforeAll, describe, expect, it, vi } from "vitest";
import { Logger } from "@gqlbase/shared/logger";
import { GraphQLTransformer } from "./GraphQLTransformer.js";
import { TransformerContext } from "../context/TransformerContext.js";
import { ITransformerPlugin } from "../plugins/ITransformerPlugin.js";
import { DefinitionNode } from "../definition/DocumentNode.js";

const mockLogger = vi.mockObject(Logger.prototype);
const context = new TransformerContext({ logger: mockLogger });

const testPlugin: ITransformerPlugin = {
  name: "TestPlugin",
  context,
  init: vi.fn(),
  match: vi.fn().mockReturnValue(true),
  normalize: vi.fn(),
  execute: vi.fn(),
  cleanup: vi.fn(),
  generate: vi.fn(),
  output: vi.fn(),
};

describe("GraphQLTransformer", () => {
  let transformer: GraphQLTransformer;

  beforeAll(() => {
    context.registerPlugin(testPlugin);
    transformer = new GraphQLTransformer(context);
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
    expect(testPlugin.match).toHaveBeenCalledTimes(8);
    expect(testPlugin.normalize).toHaveBeenCalledTimes(2);
    expect(testPlugin.execute).toHaveBeenCalledTimes(2);
    expect(testPlugin.cleanup).toHaveBeenCalledTimes(2);
    expect(testPlugin.generate).toHaveBeenCalledTimes(2);
    expect(testPlugin.output).toHaveBeenCalledTimes(1);
    expect(output.schema).toContain("type Query");
  });

  it("should prevent execution when definition does not match plugin", () => {
    const nonMatchingPlugin: ITransformerPlugin = {
      name: "NonMatchingPlugin",
      context,
      init: vi.fn(),
      match: vi.fn().mockImplementation((node: DefinitionNode) => node.name !== "User"),
      normalize: vi.fn(),
      execute: vi.fn(),
    };

    context.registerPlugin(nonMatchingPlugin);
    const transformer = new GraphQLTransformer(context);

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

    expect(nonMatchingPlugin.match).toHaveBeenCalledTimes(8);
    expect(nonMatchingPlugin.normalize).toHaveBeenCalledTimes(1);
    expect(nonMatchingPlugin.execute).toHaveBeenCalledTimes(1);
  });
});
