import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { zodSchemaGeneratorPlugin } from "../index.js";

describe("Zod scalar schemas", () => {
  let validators: string;

  beforeAll(() => {
    const output = createTransformer({ plugins: [zodSchemaGeneratorPlugin()] }).transform(
      /* GraphQL */ `
        scalar Counter @gqlbase_typehint(type: bigint)

        type Invoice @model {
          id: ID!
          amount: SafeInt!
          views: Counter!
        }
      `
    );

    validators =
      output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
  });

  it("validates SafeInt as an integer number", () => {
    expect(validators).toMatch(/amount: z\.number\(\)\.int\(\)/);
  });

  it("validates a bigint-hinted scalar as an integer number", () => {
    expect(validators).toMatch(/views: z\.number\(\)\.int\(\)/);
  });
});

describe("Zod scalars option", () => {
  let validators: string;

  beforeAll(() => {
    const output = createTransformer({
      plugins: [
        zodSchemaGeneratorPlugin({
          scalars: {
            Currency: 'z.string().regex(/^[A-Z]{3}$/, "Expected an ISO 4217 code")',
            EmailAddress: "z.email().toLowerCase()",
            String: "z.string().trim()",
            Invoice: "z.never()",
          },
        }),
      ],
    }).transform(/* GraphQL */ `
      scalar Currency @gqlbase_typehint(type: string)

      type Invoice @model {
        id: ID!
        note: String
        currency: Currency!
        codes: [Currency!]
        contact: EmailAddress
      }
    `);

    validators =
      output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
  });

  it("uses the override for a custom scalar, keeping string literals and regexes", () => {
    expect(validators).toContain(
      'currency: z.string().regex(/^[A-Z]{3}$/, "Expected an ISO 4217 code")'
    );
  });

  it("uses the override inside lists", () => {
    expect(validators).toMatch(
      /codes: z\.array\(z\.string\(\)\.regex\(\/\^\[A-Z\]\{3\}\$\/, "Expected an ISO 4217 code"\)\)/
    );
  });

  it("overrides built-in gqlbase and GraphQL scalars", () => {
    expect(validators).toMatch(/contact: z\.email\(\)\.toLowerCase\(\)/);
    expect(validators).toMatch(/note: z\.string\(\)\.trim\(\)/);
  });

  it("ignores names that are not scalars", () => {
    expect(validators).not.toContain("z.never()");
  });
});
