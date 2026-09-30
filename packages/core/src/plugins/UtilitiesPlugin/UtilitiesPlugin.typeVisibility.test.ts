import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "../../transformer/index.js";

describe("type-level @serverOnly and @clientOnly", () => {
  let schema: string;
  let types: string;

  beforeAll(() => {
    const output = createTransformer({ relay: true }).transform(/* GraphQL */ `
      type ImportJob @model @serverOnly {
        id: ID!
        source: String!
      }

      type ExchangeRate @model @clientOnly {
        id: ID!
        rate: Float!
      }

      type CategoryStats @clientOnly {
        productCount: Int!
      }

      type Category @model {
        id: ID!
        name: String!
        lastImport: ImportJob @belongsTo
        stats: CategoryStats
      }
    `);

    schema = output.schema;
    types = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
  });

  describe("@serverOnly type", () => {
    it("is removed from the output schema, even as a Node implementor", () => {
      expect(schema).not.toContain("ImportJob");
    });

    it("gets no operations or inputs", () => {
      expect(schema).not.toMatch(/getImportJob|listImportJobs|createImportJob|ImportJobInput/);
    });

    it("makes the fields that return it @serverOnly", () => {
      expect(schema).not.toContain("lastImport");
      expect(types).not.toContain("lastImport");
    });
  });

  describe("@clientOnly model", () => {
    it("gets only read operations", () => {
      expect(schema).toContain("getExchangeRate(id: ID!): ExchangeRate");
      expect(schema).toContain("listExchangeRates(");
      expect(schema).not.toMatch(/createExchangeRate|updateExchangeRate|deleteExchangeRate/);
    });

    it("stays in the schema without the directive", () => {
      expect(schema).toContain("type ExchangeRate implements Node {");
      expect(schema).not.toContain("@clientOnly");
    });
  });

  describe("@clientOnly type", () => {
    it("stays in the schema, and the fields that return it stay queryable", () => {
      expect(schema).toContain("type CategoryStats {");
      expect(schema).toMatch(/type Category implements Node \{[^}]*stats: CategoryStats/);
    });

    it("keeps the fields that return it out of inputs", () => {
      const createInput = schema.match(/input CreateCategoryInput \{[^}]*\}/)?.[0] ?? "";

      expect(createInput).toContain("name: String!");
      expect(createInput).not.toContain("stats");
    });
  });
});
