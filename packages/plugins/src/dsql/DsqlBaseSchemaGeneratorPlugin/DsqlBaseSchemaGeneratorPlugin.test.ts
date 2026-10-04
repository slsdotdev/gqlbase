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
          columns: [{ field: "createdAt", nulls: LAST }]
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
      'products.index("products_created_idx").columns(c => [c.createdAt.nullsLast()]).include(c => [c.status]).distinctNulls(false);'
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

describe("global ids", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({
      tenancy: { vendor: { claims: { vendorId: "UUID" } } },
      dataSources: {
        db: { type: "dsqlbase", default: true },
        integrations: { type: "service" },
      },
      plugins: [dsqlbase()],
    }).transform(/* GraphQL */ `
      type Vendor @model {
        id: GUID!
        products: Product @hasMany
      }

      type Product @model @scope(name: vendor) {
        id: GUID!
        parent: Product @belongsTo
        category: Category @belongsTo
        integration: Integration @belongsTo
      }

      type Category @model {
        id: ID!
      }

      type Integration @model @dataSource(name: integrations) {
        id: GUID!
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("emits a GUID id as a guid primary key", () => {
    expect(tables).toContain('id: guid("id").primaryKey().defaultRandom()');
    expect(tables).toContain('id: uuid("id").primaryKey().defaultRandom()');
  });

  it("emits a key to a node as a guid naming the node's schema alias", () => {
    expect(tables).toContain('parentId: guid("parent_id", "products")');
  });

  it("emits a claim that keys a node as a guid, whatever the claim's type", () => {
    expect(tables).toContain('vendorId: guid("vendor_id", "vendors").notNull()');
  });

  it("keeps a key to a model that is not a node a plain column", () => {
    expect(tables).toContain('categoryId: uuid("category_id")');
  });

  it("emits a key to a GUID model in another data source as text, the id as that source gives it", () => {
    expect(tables).toContain('integrationId: text("integration_id")');
  });

  it("puts __typename in every table's meta", () => {
    expect(tables).toMatch(/table\("products", \{[^;]*\}\)\.meta\(\{ __typename: "Product" as const \}\)/);
    expect(tables).toMatch(/table\("categories", \{[^;]*\}\)\.meta\(\{ __typename: "Category" as const \}\)/);
  });
});

describe("global ids: errors", () => {
  it("rejects a GUID field that is neither an id nor a relation key", () => {
    expect(() =>
      createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
        type Vendor @model {
          id: GUID!
          ownerRef: GUID
        }
      `)
    ).toThrow(/Vendor.ownerRef is a GUID, which identifies a model/);
  });
});

describe("polymorphic relations", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
      union Owner = Invoice | PaymentOrder

      interface Document {
        title: String!
      }

      type Invoice implements Document @model {
        id: GUID!
        title: String!
        resources: Resource @hasMany(key: "ownerId")
      }

      type PaymentOrder implements Document @model {
        id: GUID!
        title: String!
      }

      type Resource @model {
        id: GUID!
        owner: Owner @belongsTo
      }

      type Folder @model {
        id: GUID!
        documents: Document @hasMany
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("exports a union of the members a relation targets", () => {
    expect(tables).toContain("export const owners = union({ invoices, paymentOrders });");
    expect(tables).toContain("export const documents = union({ invoices, paymentOrders });");
  });

  it("stores a @belongsTo to a union as a keyless guid and a discriminator typed by the member aliases", () => {
    expect(tables).toContain('ownerId: guid("owner_id")');
    expect(tables).toContain('ownerType: text("owner_type").$type<"invoices" | "paymentOrders">()');
  });

  it("relates a @belongsTo to the union through the discriminator", () => {
    expect(tables).toMatch(
      /owner: belongsTo\(owners, \{\s+from: \[resources\.columns\.ownerId\],\s+to: \[owners\.columns\.id\],\s+discriminator: resources\.columns\.ownerType\s+\}\)/
    );
  });

  it("relates a @hasMany to an interface through each member's key", () => {
    expect(tables).toMatch(
      /documents: hasMany\(documents, \{\s+from: \[folders\.columns\.id\],\s+to: \{ invoices: \[invoices\.columns\.folderId\], paymentOrders: \[paymentOrders\.columns\.folderId\] \}\s+\}\)/
    );
    expect(tables).toContain('folderId: guid("folder_id", "folders")');
  });

  it("keeps a member's reverse relation on the polymorphic key", () => {
    expect(tables).toMatch(
      /resources: hasMany\(resources, \{\s+from: \[invoices\.columns\.id\],\s+to: \[resources\.columns\.ownerId\]\s+\}\)/
    );
  });
});

describe("polymorphic relations: errors", () => {
  it("rejects a union exported under a table's alias", () => {
    expect(() =>
      createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
        union Items = Photo | Video

        type Item @model {
          id: ID!
        }

        type Photo @model {
          id: ID!
        }

        type Video @model {
          id: ID!
        }

        type Post @model {
          id: ID!
          item: Items @belongsTo
        }
      `)
    ).toThrow(/Items would be exported as "items", which is already a table's schema alias/);
  });
});
