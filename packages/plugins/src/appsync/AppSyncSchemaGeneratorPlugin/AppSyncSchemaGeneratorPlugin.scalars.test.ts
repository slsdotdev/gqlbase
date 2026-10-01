import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { appsyncPreset } from "../index.js";

describe("AppSync scalar mapping", () => {
  let schema: string;

  beforeAll(() => {
    const output = createTransformer({
      plugins: [appsyncPreset({ middyAppSync: { enable: false } })],
    }).transform(/* GraphQL */ `
      scalar Slug @gqlbase_typehint(type: id)
      scalar Currency @gqlbase_typehint(type: string)
      scalar Ratio @gqlbase_typehint(type: number)
      scalar Cents @gqlbase_typehint(type: bigint)
      scalar Flag @gqlbase_typehint(type: boolean)
      scalar Settings @gqlbase_typehint(type: object)

      type Invoice @model {
        id: ID!
        amount: SafeInt!
        slug: Slug!
        currency: Currency!
        ratio: Ratio
        cents: Cents
        paid: Flag
        settings: Settings
      }
    `);

    schema = output.files.find((file) => file.path === "appsync/schema.graphql")?.content ?? "";
  });

  it("maps SafeInt to Long", () => {
    expect(schema).toMatch(/amount: Long!/);
    expect(schema).not.toMatch(/[:[]\s*SafeInt\b/);
  });

  it("maps custom scalars by their type hint", () => {
    const invoice = schema.match(/type Invoice \{[^}]*\}/)?.[0] ?? "";

    expect(invoice).toContain("slug: ID!");
    expect(invoice).toContain("currency: String!");
    expect(invoice).toContain("ratio: Float");
    expect(invoice).toContain("cents: Long");
    expect(invoice).toContain("paid: Boolean");
    expect(invoice).toContain("settings: AWSJSON");
  });

  it("maps a hinted scalar in filter inputs too", () => {
    expect(schema).toMatch(/input CurrencyFilterInput \{[^}]*eq: String/);
  });
});

describe("AppSync scalarMappings", () => {
  let schema: string;

  beforeAll(() => {
    const output = createTransformer({
      plugins: [
        appsyncPreset({
          middyAppSync: { enable: false },
          scalarMappings: { Currency: "AWSJSON", Opaque: "String" },
        }),
      ],
    }).transform(/* GraphQL */ `
      scalar Currency @gqlbase_typehint(type: string)
      scalar Opaque

      type Invoice @model {
        id: ID!
        currency: Currency!
        blob: Opaque
      }
    `);

    schema = output.files.find((file) => file.path === "appsync/schema.graphql")?.content ?? "";
  });

  it("overrides the type hint", () => {
    expect(schema).toContain("currency: AWSJSON!");
  });

  it("maps a scalar without a hint", () => {
    expect(schema).toContain("blob: String");
  });
});

describe("AppSync scalar without a hint or mapping", () => {
  it("throws, naming the scalar and the scalarMappings option", () => {
    expect(() =>
      createTransformer({
        plugins: [appsyncPreset({ middyAppSync: { enable: false } })],
      }).transform(/* GraphQL */ `
        scalar Opaque

        type Invoice @model {
          id: ID!
          blob: Opaque
        }
      `)
    ).toThrow(/Scalar Opaque has no AppSync mapping[\s\S]*scalarMappings: \{ Opaque:/);
  });
});
