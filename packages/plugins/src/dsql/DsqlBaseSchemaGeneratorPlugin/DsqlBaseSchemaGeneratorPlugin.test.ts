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
    expect(tables).toContain('record("meta").$type<ImportMeta>()');
    expect(tables).not.toMatch(/import \{[^}]*ImportMeta[^}]*\} from/);
  });
});

describe("tenancy scopes", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({
      tenancy: {
        vendor: { claims: { vendorId: "UUID" } },
        user: { claims: { userId: "UUID" } },
        global: { claims: null },
      },
      plugins: [dsqlbase()],
    }).transform(/* GraphQL */ `
      type Vendor @model {
        id: GUID!
        products: Product @hasMany
      }

      type Product @model @scope(name: vendor) {
        id: GUID!
        name: String!
      }

      type Schedule @model @scope(name: vendor) {
        id: ID!
      }

      type Cart @model @scope(name: user) {
        id: ID!
      }

      type Currency @model @scope(name: global) {
        id: ID!
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("declares each scope with claims as a tenantScope of its claim columns", () => {
    expect(tables).toMatch(
      /export const userScope = tenantScope\(\{\s*userId: uuid\("user_id"\)\.notNull\(\)\s*\}\);/
    );
  });

  it("gives a claim that keys a node in one table the node's guid in every table of the scope", () => {
    expect(tables).toMatch(
      /export const vendorScope = tenantScope\(\{\s*vendorId: guid\("vendor_id", "vendors"\)\.notNull\(\)\s*\}\);/
    );
  });

  it("emits a scoped model through its scope, without the claim columns", () => {
    expect(tables).toContain('export const products = vendorScope.table("products", {');
    expect(tables).toContain('export const schedules = vendorScope.table("schedules", {');
    expect(tables).toContain('export const carts = userScope.table("carts", {');
    expect(tables).not.toMatch(/(vendor|user)Id: \w+\("(vendor|user)_id"\)[^;]*\}\)\.meta/);
    expect(tables.match(/"vendor_id"/g)).toHaveLength(1);
  });

  it("emits a model in a scope without claims, or in none, as a plain table", () => {
    expect(tables).toContain('export const currencies = table("currencies", {');
    expect(tables).toContain('export const vendors = table("vendors", {');
    expect(tables).not.toContain("globalScope");
  });

  it("declares the scopes before the tables", () => {
    expect(tables.indexOf("export const vendorScope")).toBeLessThan(
      tables.indexOf("export const vendors =")
    );
  });

  it("keeps relations on a claim working through the scope's column", () => {
    expect(tables).toContain("to: [products.columns.vendorId]");
  });
});

describe("tenancy scopes: errors", () => {
  it("rejects a claim keying two models", () => {
    expect(() =>
      createTransformer({
        tenancy: { vendor: { claims: { ownerId: "UUID" } } },
        plugins: [dsqlbase()],
      }).transform(/* GraphQL */ `
        type Vendor @model {
          id: GUID!
          products: Product @hasMany(key: "ownerId")
        }

        type Market @model {
          id: GUID!
          stalls: Stall @hasMany(key: "ownerId")
        }

        type Product @model @scope(name: vendor) {
          id: ID!
        }

        type Stall @model @scope(name: vendor) {
          id: ID!
        }
      `)
    ).toThrow(/Tenancy claim ownerId is a key to (vendors and markets|markets and vendors)/);
  });

  it("rejects an @embedded type exported under a scope's alias", () => {
    expect(() =>
      createTransformer({
        tenancy: { vendor: { claims: { vendorId: "UUID" } } },
        plugins: [dsqlbase()],
      }).transform(/* GraphQL */ `
        type VendorScope @embedded {
          label: String!
        }

        type Product @model @scope(name: vendor) {
          id: ID!
          scope: VendorScope!
        }
      `)
    ).toThrow(
      /@embedded type VendorScope would be exported as "vendorScope", which is already a tenancy scope/
    );
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
    expect(tables).toMatch(
      /table\("products", \{[^;]*\}\)\.meta\(\{ __typename: "Product" as const \}\)/
    );
    expect(tables).toMatch(
      /table\("categories", \{[^;]*\}\)\.meta\(\{ __typename: "Category" as const \}\)/
    );
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

describe("embedded objects", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
      enum Currency {
        EUR
        USD
      }

      type Money @embedded {
        amount: Int!
        currency: Currency!
      }

      type Geo @embedded {
        lat: Float
        lng: Float
      }

      type Address @embedded {
        city: String!
        geo: Geo
        lines: [String!]
      }

      type Note {
        text: String
      }

      type Product
        @model
        @index(name: "products_price_idx", columns: [{ field: "price.amount" }])
        @unique(fields: ["address.geo.lat", "address.geo.lng"]) {
        id: ID!
        price: Money!
        compareAt: Money
        address: Address
        tags: [String!]
        prices: [Money!]
        note: Note
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("declares an embedded type once, with its members as columns", () => {
    expect(tables).toMatch(
      /export const money = embedded\(\{\s+amount: int\("amount"\)\.notNull\(\),\s+currency: currencyEnum\.column\("currency"\)\.notNull\(\)\s+\}\);/
    );
  });

  it("places a group in the table under the field's name", () => {
    expect(tables).toContain('price: money.column("price")');
  });

  it("gives a nullable field of a type with required members a shape whose members are all nullable", () => {
    expect(tables).toMatch(
      /export const moneyNullable = embedded\(\{\s+amount: int\("amount"\),\s+currency: currencyEnum\.column\("currency"\)\s+\}\);/
    );
    expect(tables).toContain('compareAt: moneyNullable.column("compare_at")');
  });

  it("nests groups, and needs no second shape for a type whose members are all nullable", () => {
    expect(tables).toMatch(
      /export const geo = embedded\(\{\s+lat: real\("lat"\),\s+lng: real\("lng"\)\s+\}\);/
    );
    expect(tables).toMatch(/geo: geo\.column\("geo"\)/);
    expect(tables).not.toContain("geoNullable");
    expect(tables).toContain('address: addressNullable.column("address")');
  });

  it("declares nested shapes before the shapes and tables that use them", () => {
    expect(tables.indexOf("export const geo ")).toBeLessThan(
      tables.indexOf("export const addressNullable ")
    );
    expect(tables.indexOf("export const addressNullable ")).toBeLessThan(
      tables.indexOf("export const products ")
    );
  });

  it("emits the enum a member uses", () => {
    expect(tables).toContain('$enum("currency_enum"');
  });

  it("stores lists, embedded items included, as jsonb arrays", () => {
    expect(tables).toContain('tags: array("tags").$type<string[]>()');
    expect(tables).toContain('prices: array("prices").$type<MoneyOwnFields[]>()');
    expect(tables).toContain('lines: array("lines").$type<string[]>()');
  });

  it("stores any other object as a jsonb record", () => {
    expect(tables).toContain('note: record("note").$type<NoteOwnFields>()');
    expect(tables).not.toMatch(/\bjson\(/);
  });

  it("indexes members by path", () => {
    expect(tables).toContain(
      'products.index("products_price_idx").columns(c => [c.price.amount]);'
    );
    expect(tables).toContain("products.unique(c => [c.address.geo.lat, c.address.geo.lng]);");
  });
});

describe("embedded objects: errors", () => {
  it("rejects a shape exported under a table's alias", () => {
    expect(() =>
      createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
        type Items @embedded {
          count: Int
        }

        type Item @model {
          id: ID!
          items: Items
        }
      `)
    ).toThrow(/@embedded type Items would be exported as "items"/);
  });
});

describe("column defaults", () => {
  let tables: string;
  let schema: string;
  let validators: string;

  beforeAll(() => {
    const output = createTransformer({
      plugins: [dsqlbase(), zodSchemaGeneratorPlugin()],
    }).transform(/* GraphQL */ `
      enum Status {
        ACTIVE
        ARCHIVED
      }

      interface Timestamped {
        createdAt: DateTime! @defaultNow
        updatedAt: DateTime! @defaultNow @default(onUpdate: "() => new Date().toISOString()")
      }

      type Money @embedded {
        amount: Int!
        currency: String! @default(value: "\\"EUR\\"")
      }

      type Product implements Timestamped @model {
        id: ID!
        name: String!
        status: Status! @default(value: "\\"ACTIVE\\"")
        archived: Boolean! @default(value: "false")
        token: UUID! @defaultRandom
        slug: String! @default(onCreate: "() => crypto.randomUUID()")
        touchedAt: DateTime @default(onUpdate: "() => new Date().toISOString()")
        price: Money! @default(value: "{ amount: 0 }")
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
    validators =
      output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
    schema = output.schema;
  });

  it("emits @default(value:) as .default() with the value as written", () => {
    expect(tables).toContain('status: statusEnum.column("status").notNull().default("ACTIVE")');
    expect(tables).toContain('archived: bool("archived").notNull().default(false)');
  });

  it("emits @defaultRandom and @defaultNow", () => {
    expect(tables).toContain('token: uuid("token").notNull().defaultRandom()');
    expect(tables).toContain(
      'createdAt: timestamp("created_at", { mode: "iso" }).notNull().defaultNow()'
    );
  });

  it("emits onCreate and onUpdate as hooks, and reaches fields an interface adds", () => {
    expect(tables).toContain('slug: text("slug").notNull().$onCreate(() => crypto.randomUUID())');
    expect(tables).toContain(
      'updatedAt: timestamp("updated_at", { mode: "iso" }).notNull().defaultNow().$onUpdate(() => new Date().toISOString())'
    );
  });

  it("emits a default on an @embedded member and on a group", () => {
    expect(tables).toContain('currency: text("currency").notNull().default("EUR")');
    expect(tables).toContain('price: money.column("price").default({ amount: 0 })');
  });

  it("makes the fields filled on create optional in the create input", () => {
    expect(schema).toMatch(
      /input CreateProductInput \{\s+id: ID\s+name: String!\s+status: Status\s+archived: Boolean\s+token: UUID\s+slug: String\s+touchedAt: DateTime\s+price: MoneyInput\s+createdAt: DateTime\s+updatedAt: DateTime\s+\}/
    );
  });

  it("keeps a field with only onUpdate as declared, and nested inputs too", () => {
    expect(schema).toMatch(/input MoneyInput \{\s+amount: Int!\s+currency: String!\s+\}/);
  });

  it("makes them optional in the Zod create schema, following the input", () => {
    expect(validators).toMatch(/CreateProductInputSchema = z\.object\(\{[^}]*name: z\.string\(\),/);
    expect(validators).toMatch(
      /CreateProductInputSchema = z\.object\(\{[^}]*archived: z\.boolean\(\)\.optional\(\),/
    );
  });

  it("keeps the fields non-null in the output and removes the directives", () => {
    expect(schema).toMatch(/type Product implements Timestamped \{[^}]*archived: Boolean!/);
    expect(schema).not.toMatch(/@default|@defaultNow|@defaultRandom|gqlbase_hasDefault/);
  });
});

describe("column defaults: errors", () => {
  const transform = (sdl: string) => createTransformer({ plugins: [dsqlbase()] }).transform(sdl);

  it("rejects @defaultNow on a column that is not a timestamp", () => {
    expect(() =>
      transform(/* GraphQL */ `
        type Event @model {
          id: ID!
          day: Date! @defaultNow
        }
      `)
    ).toThrow(/@defaultNow on day needs a timestamp column/);
  });

  it("rejects @defaultRandom on a column that is not a uuid", () => {
    expect(() =>
      transform(/* GraphQL */ `
        type Event @model {
          id: ID!
          code: String! @defaultRandom
        }
      `)
    ).toThrow(/@defaultRandom on code needs a uuid or guid column/);
  });

  it("rejects two database defaults", () => {
    expect(() =>
      transform(/* GraphQL */ `
        type Event @model {
          id: ID!
          at: DateTime! @defaultNow @default(value: "\\"2026-01-01T00:00:00Z\\"")
        }
      `)
    ).toThrow(/Event.at has more than one database default \(@defaultNow, @default\(value:\)\)/);
  });

  it("rejects @default without arguments", () => {
    expect(() =>
      transform(/* GraphQL */ `
        type Event @model {
          id: ID!
          name: String! @default
        }
      `)
    ).toThrow(/@default on Event.name sets nothing/);
  });

  it("rejects code that is not a TypeScript expression", () => {
    expect(() =>
      transform(/* GraphQL */ `
        type Event @model {
          id: ID!
          name: String! @default(onCreate: "() => {")
        }
      `)
    ).toThrow(/@default\(onCreate:\) on name is not a TypeScript expression/);
  });

  it("rejects defaults on a type that has no columns", () => {
    expect(() =>
      transform(/* GraphQL */ `
        type Meta {
          rows: Int! @default(value: "0")
        }

        type Event @model {
          id: ID!
          meta: Meta
        }
      `)
    ).toThrow(/Meta is neither, so Meta.rows has no column/);
  });

  it("rejects hooks on an @embedded group", () => {
    expect(() =>
      transform(/* GraphQL */ `
        type Money @embedded {
          amount: Int!
        }

        type Event @model {
          id: ID!
          fee: Money @default(onCreate: "() => ({ amount: 0 })")
        }
      `)
    ).toThrow(/Event.fee is an @embedded group, which takes only @default\(value:\)/);
  });

  it("rejects a default other than @defaultRandom on the primary key", () => {
    expect(() =>
      transform(/* GraphQL */ `
        type Event @model {
          id: ID! @default(onCreate: "() => crypto.randomUUID()")
        }
      `)
    ).toThrow(/Event.id is the primary key/);
  });
});
