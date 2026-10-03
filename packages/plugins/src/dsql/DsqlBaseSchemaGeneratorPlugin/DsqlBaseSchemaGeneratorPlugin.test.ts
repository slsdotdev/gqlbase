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
    expect(tables).toMatch(
      /import \{[^}]*type AddressOwnFields[^}]*\} from "\.\.\/schema\.types\.js";/
    );
    expect(tables).toMatch(
      /export type \{[^}]*\bAddressOwnFields\b[^}]*\} from "\.\.\/schema\.types\.js";/
    );
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

describe("indexes and unique constraints", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({
      tenancy: { vendor: { claims: { vendorId: "ID" } } },
      plugins: [dsqlbase()],
    }).transform(/* GraphQL */ `
      type Product
        @model
        @scope(name: vendor)
        @index(
          name: "products_vendor_slug_idx"
          unique: true
          columns: [{ field: "vendorId" }, { field: "slug" }]
        )
        @index(
          name: "products_created_idx"
          columns: [{ field: "createdAt", sort: DESC, nulls: LAST }]
          include: ["status"]
          distinctNulls: false
        )
        @unique(fields: ["vendorId", "sku"]) {
        id: ID!
        slug: String!
        sku: String!
        code: String! @unique
        status: String
        createdAt: String
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("marks a @unique field's column unique", () => {
    expect(tables).toContain('code: text("code").notNull().unique()');
  });

  it("emits a unique index, on a tenancy claim and a field", () => {
    expect(tables).toContain(
      'products.index("products_vendor_slug_idx", { unique: true }).columns(c => [c.vendorId, c.slug]);'
    );
  });

  it("emits per-column order, include and distinctNulls", () => {
    expect(tables).toContain(
      'products.index("products_created_idx").columns(c => [c.createdAt.sort("DESC").nullsLast()]).include(c => [c.status]).distinctNulls(false);'
    );
  });

  it("emits a composite unique constraint", () => {
    expect(tables).toContain("products.unique(c => [c.vendorId, c.sku]);");
  });

  it("declares them after the table", () => {
    expect(tables.indexOf("products.index(")).toBeGreaterThan(
      tables.indexOf('export const products = table("products"')
    );
  });
});

describe("data sources", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({
      dataSources: {
        db: { type: "dsqlbase", default: true },
        integrations: { type: "service" },
      },
      plugins: [dsqlbase()],
    }).transform(/* GraphQL */ `
      enum IntegrationKind {
        ACCOUNTING
      }

      type Vendor @model {
        id: ID!
        integrations: [Integration!]! @hasMany
        primaryIntegration: Integration @belongsTo
      }

      type Integration @model @dataSource(name: integrations) {
        id: ID!
        kind: IntegrationKind!
        vendor: Vendor @belongsTo
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("emits a table only for the models of a dsqlbase source", () => {
    expect(tables).toContain('export const vendors = table("vendors"');
    expect(tables).not.toContain("integrations = table(");
  });

  it("keeps the key column of a relation into another source, without the relation", () => {
    expect(tables).toMatch(/primaryIntegrationId: \w+\("primary_integration_id"\)/);
    expect(tables).not.toMatch(/primaryIntegration: belongsTo/);
    expect(tables).not.toMatch(/integrations: hasMany/);
  });

  it("emits only the enums its own tables use", () => {
    expect(tables).not.toContain("IntegrationKind");
  });
});

describe("data sources: errors", () => {
  it("rejects two dsqlbase sources", () => {
    expect(() =>
      createTransformer({
        dataSources: {
          a: { type: "dsqlbase", default: true },
          b: { type: "dsqlbase" },
        },
        plugins: [dsqlbase()],
      })
    ).toThrow(/Only one data source can have type "dsqlbase"; a, b do/);
  });

  it("rejects table directives on a model in another source", () => {
    expect(() =>
      createTransformer({
        dataSources: {
          db: { type: "dsqlbase", default: true },
          integrations: { type: "service" },
        },
        plugins: [dsqlbase()],
      }).transform(/* GraphQL */ `
        type Integration
          @model
          @dataSource(name: integrations)
          @index(name: "by_kind", columns: [{ field: "kind" }]) {
          id: ID!
          kind: String!
        }
      `)
    ).toThrow(/@index and @unique apply to dsqlbase tables.*Integration is not one/);
  });
});
