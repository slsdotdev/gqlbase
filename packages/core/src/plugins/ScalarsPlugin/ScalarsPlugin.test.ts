import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "../../transformer/index.js";

describe("ScalarsPlugin SafeInt", () => {
  let schema: string;
  let types: string;

  beforeAll(() => {
    const output = createTransformer().transform(/* GraphQL */ `
      type Invoice @model {
        id: ID!
        amount: SafeInt!
      }
    `);

    schema = output.schema;
    types = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
  });

  it("declares SafeInt in the schema", () => {
    expect(schema).toContain("scalar SafeInt");
  });

  it("types SafeInt as number", () => {
    expect(types).toMatch(/amount: number;/);
  });

  it("filters SafeInt like a number", () => {
    const filterInput = schema.match(/input SafeIntFilterInput \{[^}]*\}/)?.[0] ?? "";

    expect(filterInput).toContain("gt: SafeInt");
    expect(filterInput).toContain("between: [SafeInt!]");
  });
});
