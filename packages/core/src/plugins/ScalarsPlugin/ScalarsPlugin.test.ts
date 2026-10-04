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
    expect(types).toMatch(/SafeInt: \{\s+input: number;\s+output: number;\s+\};/);
    expect(types).toContain('amount: Scalars["SafeInt"]["output"];');
  });

  it("filters SafeInt like a number", () => {
    const filterInput = schema.match(/input SafeIntFilterInput \{[^}]*\}/)?.[0] ?? "";

    expect(filterInput).toContain("gt: SafeInt");
    expect(filterInput).toContain("between: [SafeInt!]");
  });
});

describe("ScalarsPlugin GUID", () => {
  let schema: string;
  let types: string;

  beforeAll(() => {
    const output = createTransformer({ relay: true }).transform(/* GraphQL */ `
      interface Node {
        id: GUID!
      }

      type Category @model {
        name: String!
        parent: Category @belongsTo
      }

      type Product @model {
        id: GUID!
        name: String!
        category: Category! @belongsTo
      }
    `);

    schema = output.schema;
    types = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
  });

  it("declares GUID in the schema", () => {
    expect(schema).toContain("scalar GUID");
  });

  it("types GUID as string", () => {
    expect(types).toMatch(/GUID: \{\s+input: string;\s+output: string;\s+\};/);
  });

  it("gives a model without an id the id Node declares", () => {
    const category = schema.match(/type Category implements Node \{[^}]*\}/)?.[0] ?? "";

    expect(category).toContain("id: GUID!");
  });

  it("takes the id as the model's id type in get, delete and node", () => {
    expect(schema).toContain("getCategory(id: GUID!): Category");
    expect(schema).toContain("node(id: GUID!): Node");
    expect(schema).toContain("deleteProduct(id: GUID!): Product");
  });

  it("filters GUID like an id", () => {
    const filterInput = schema.match(/input GUIDFilterInput \{[^}]*\}/)?.[0] ?? "";

    expect(filterInput).toContain("eq: GUID");
    expect(filterInput).toContain("in: [GUID!]");
  });
});
