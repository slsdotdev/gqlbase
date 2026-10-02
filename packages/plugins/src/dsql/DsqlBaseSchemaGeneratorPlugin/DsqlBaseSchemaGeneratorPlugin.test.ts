import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { zodSchemaGeneratorPlugin } from "../../zod/index.js";
import { dsqlbase } from "../index.js";

describe("type-level visibility in stored outputs", () => {
  let tables: string;
  let validators: string;

  beforeAll(() => {
    const output = createTransformer({
      plugins: [dsqlbase(), zodSchemaGeneratorPlugin()],
    }).transform(/* GraphQL */ `
      type ImportMeta @serverOnly {
        rows: Int!
      }

      type Address {
        city: String!
      }

      type ImportJob @model @serverOnly {
        id: ID!
        source: String!
        meta: ImportMeta
      }

      type ExchangeRate @model @clientOnly {
        id: ID!
        rate: Float!
      }

      enum Status {
        ACTIVE
      }

      enum Tag {
        NEW
      }

      enum Unused {
        A
      }

      type Category @model {
        id: ID!
        status: Status
        tags: [Tag!]
        address: Address
        lastImport: ImportJob @belongsTo
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
    validators =
      output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
  });

  it("keeps a table for a @serverOnly model, with no Zod schemas", () => {
    expect(tables).toContain('table("import_jobs"');
    expect(tables).toContain('lastImportId: uuid("last_import_id")');
    expect(validators).not.toContain("ImportJob");
  });

  it("gives a @clientOnly model no table and no create/update schemas", () => {
    expect(tables).not.toContain("exchange_rates");
    expect(validators).toContain("export const ExchangeRateSchema");
    expect(validators).not.toContain("CreateExchangeRateInputSchema");
    expect(validators).not.toContain("UpdateExchangeRateInputSchema");
  });

  it("emits $enum only for enums a column uses", () => {
    expect(tables).toContain('$enum("status_enum"');
    expect(tables).not.toContain("tag_enum");
    expect(tables).not.toContain("unused_enum");
  });

  it("imports and re-exports public column types from the schema types", () => {
    expect(tables).toMatch(/import \{[^}]*type Address[^}]*\} from "\.\.\/schema\.types\.js";/);
    expect(tables).toMatch(/export type \{[^}]*\bAddress\b[^}]*\} from "\.\.\/schema\.types\.js";/);
  });

  it("declares a column type locally when the schema types do not export it", () => {
    expect(tables).toMatch(/export type ImportMeta = \{\s*rows: number;\s*\};/);
    expect(tables).toContain('json("meta").$type<ImportMeta>()');
    expect(tables).not.toMatch(/import \{[^}]*ImportMeta[^}]*\} from/);
  });
});

describe("tenancy claims in the tables", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({
      tenancy: { vendor: { claims: { vendorId: "ID" } } },
      plugins: [dsqlbase()],
    }).transform(/* GraphQL */ `
      type Product @model @scope(name: vendor) {
        id: ID!
        name: String!
        category: Category @belongsTo
      }

      type Category @model {
        id: ID!
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("emits a claim as a not-null column", () => {
    expect(tables).toMatch(/vendorId: \w+\("vendor_id"\)\.notNull\(\)/);
  });
});
