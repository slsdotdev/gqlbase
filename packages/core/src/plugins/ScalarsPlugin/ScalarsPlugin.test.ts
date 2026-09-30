import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "../../transformer/index.js";

describe("ScalarsPlugin BigInt", () => {
  let schema: string;
  let types: string;

  beforeAll(() => {
    const output = createTransformer().transform(/* GraphQL */ `
      type Invoice @model {
        id: ID!
        amount: BigInt!
      }
    `);

    schema = output.schema;
    types = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
  });

  it("declares BigInt in the schema", () => {
    expect(schema).toContain("scalar BigInt");
  });

  it("types BigInt as number", () => {
    expect(types).toMatch(/amount: number;/);
  });

  it("filters BigInt like a number", () => {
    const filterInput = schema.match(/input BigIntFilterInput \{[^}]*\}/)?.[0] ?? "";

    expect(filterInput).toContain("gt: BigInt");
    expect(filterInput).toContain("between: [BigInt!]");
  });
});
