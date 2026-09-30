import { describe, expect, it } from "vitest";
import { ITransformerContext } from "../context/index.js";
import { createTransformer } from "./createTransformer.js";

describe("createTransformer", () => {
  it("passes the transformer options to the context", () => {
    let context: ITransformerContext | undefined;

    createTransformer({
      relay: true,
      semanticNullability: true,
      plugins: [
        {
          create: (ctx) => {
            context = ctx;
            return {
              name: "ProbePlugin",
              context: ctx,
              init: () => undefined,
              match: () => false,
            };
          },
        },
      ],
    });

    expect(context?.options).toEqual({
      relay: true,
      semanticNullability: true,
      operations: ["read", "write"],
    });
  });

  it("registers the core plugins first, in order, then the configured ones", () => {
    let context: ITransformerContext | undefined;

    createTransformer({
      plugins: [
        {
          create: (ctx) => {
            context = ctx;
            return { name: "ProbePlugin", context: ctx, init: () => undefined, match: () => false };
          },
        },
      ],
    });

    expect(context?.plugins.map((plugin) => plugin.name)).toEqual([
      "InternalUtilsPlugin",
      "UtilitiesPlugin",
      "InterfaceUtilsPlugin",
      "ScalarsPlugin",
      "RfcFeaturesPlugin",
      "ModelPlugin",
      "RelationsPlugin",
      "SchemaGeneratorPlugin",
      "ModelTypesGeneratorPlugin",
      "ProbePlugin",
    ]);
  });

  it("transforms a schema with no configured plugins", () => {
    const output = createTransformer().transform(/* GraphQL */ `
      type Post @model {
        id: ID!
        title: String!
      }
    `);

    expect(output.schema).toContain("getPost(id: ID!): Post");
    expect(output.files.map((file) => file.filename)).toEqual([
      "schema.graphql",
      "models.typegen.ts",
    ]);
  });
});
