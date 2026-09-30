import { describe, expect, it } from "vitest";
import { ITransformerContext } from "../context/index.js";
import { TransformerValidationError } from "@gqlbase/shared/errors";
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

  it("registers RfcFeaturesPlugin after ScalarsPlugin only when semanticNullability is on", () => {
    let withOption: ITransformerContext | undefined;
    let withoutOption: ITransformerContext | undefined;

    createTransformer({
      semanticNullability: true,
      plugins: [
        {
          create: (ctx) => {
            withOption = ctx;
            return { name: "ProbePlugin", context: ctx, init: () => undefined, match: () => false };
          },
        },
      ],
    });

    createTransformer({
      plugins: [
        {
          create: (ctx) => {
            withoutOption = ctx;
            return { name: "ProbePlugin", context: ctx, init: () => undefined, match: () => false };
          },
        },
      ],
    });

    const names = withOption?.plugins.map((plugin) => plugin.name) ?? [];

    expect(names[names.indexOf("ScalarsPlugin") + 1]).toBe("RfcFeaturesPlugin");
    expect(withoutOption?.plugins.map((plugin) => plugin.name)).not.toContain("RfcFeaturesPlugin");
  });

  it("rejects @semanticNonNull when semanticNullability is off", () => {
    const source = /* GraphQL */ `
      type Post @model {
        id: ID!
        title: String @semanticNonNull
      }
    `;

    expect(createTransformer({ semanticNullability: true }).transform(source).schema).toContain(
      "title: String @semanticNonNull"
    );
    expect(() => createTransformer().transform(source)).toThrow(TransformerValidationError);
  });
});
