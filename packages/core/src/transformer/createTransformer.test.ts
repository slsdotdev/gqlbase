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

  it("registers the Relay plugins after RelationsPlugin when relay is on", () => {
    let context: ITransformerContext | undefined;

    createTransformer({
      relay: true,
      plugins: [
        {
          create: (ctx) => {
            context = ctx;
            return { name: "ProbePlugin", context: ctx, init: () => undefined, match: () => false };
          },
        },
      ],
    });

    const names = context?.plugins.map((plugin) => plugin.name) ?? [];

    expect(
      names.slice(names.indexOf("RelationsPlugin"), names.indexOf("RelationsPlugin") + 3)
    ).toEqual(["RelationsPlugin", "NodeInterfacePlugin", "ConnectionPlugin"]);
  });

  it("generates Relay connections only when relay is on", () => {
    const source = /* GraphQL */ `
      type User @model {
        id: ID!
        posts: Post @hasMany
      }

      type Post @model {
        id: ID!
      }
    `;

    const withRelay = createTransformer({ relay: true }).transform(source);
    const withoutRelay = createTransformer().transform(source);

    expect(withRelay.schema).toContain("interface Node");
    expect(withRelay.schema).toContain("type PostConnection");
    expect(withoutRelay.schema).not.toContain("interface Node");
    expect(withoutRelay.schema).not.toContain("PostEdge");
  });
});
