import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { dsqlbase } from "../index.js";

describe("DsqlBaseUtilsPlugin", () => {
  describe("valid table directives", () => {
    let schema: string;

    beforeAll(() => {
      const output = createTransformer({
        tenancy: { vendor: { claims: { vendorId: "ID" } } },
        plugins: [dsqlbase()],
      }).transform(/* GraphQL */ `
        type Vendor @model {
          id: ID!
          slug: String! @unique
          products: Product @hasMany
        }

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
          status: Status!
          createdAt: String
        }

        enum Status {
          ACTIVE
        }
      `);

      schema = output.files.find((file) => file.path === "schema.graphql")?.content ?? "";
    });

    it("accepts relation keys and tenancy claims as columns", () => {
      expect(schema).toContain("type Product");
    });

    it("leaves the directives and their types out of the output", () => {
      expect(schema).not.toMatch(/@index|@unique/);
      expect(schema).not.toMatch(/DsqlIndexColumn|DsqlNullsOrder/);
    });
  });

  describe("errors", () => {
    it("rejects a field the type does not have", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model @index(name: "products_sku_idx", columns: [{ field: "sku" }]) {
            id: ID!
          }
        `)
      ).toThrow(/@index on Product names "sku", which is not a field of Product/);
    });

    it("rejects a relation field, pointing at its key", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Vendor @model {
            id: ID!
          }

          type Product @model @index(name: "products_vendor_idx", columns: [{ field: "vendor" }]) {
            id: ID!
            vendor: Vendor @belongsTo
          }
        `)
      ).toThrow(/names vendor, which is not stored as a column. Name its key field instead/);
    });

    it("rejects a jsonb column", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model {
            id: ID!
            tags: [String!]! @unique
          }
        `)
      ).toThrow(/@unique on Product names tags, a jsonb column, which DSQL cannot index/);
    });

    it("rejects a path into an object that is not embedded", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model @unique(fields: ["price.amount"]) {
            id: ID!
            price: Money!
          }

          type Money {
            amount: Int!
          }
        `)
      ).toThrow(/names "price.amount", but Product.price is not an @embedded field/);
    });

    it("rejects an embedded field named whole", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model @index(name: "by_price_idx", columns: [{ field: "price" }]) {
            id: ID!
            price: Money!
          }

          type Money @embedded {
            amount: Int!
          }
        `)
      ).toThrow(/names price, a group of columns. Name its members instead/);
    });

    it("rejects a path to a member that does not exist", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model @unique(fields: ["price.value"]) {
            id: ID!
            price: Money!
          }

          type Money @embedded {
            amount: Int!
          }
        `)
      ).toThrow(/names "price.value", which is not a field of Money/);
    });

    it("rejects @unique on a member of an embedded type", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model {
            id: ID!
            price: Money!
          }

          type Money @embedded {
            amount: Int! @unique
          }
        `)
      ).toThrow(/not to the @embedded type Money/);
    });

    it("rejects an index name used twice", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model @index(name: "by_name_idx", columns: [{ field: "name" }]) {
            id: ID!
            name: String!
          }

          type Vendor @model @index(name: "by_name_idx", columns: [{ field: "name" }]) {
            id: ID!
            name: String!
          }
        `)
      ).toThrow(/Index name "by_name_idx" is used on both Product and Vendor/);
    });

    it("rejects @unique on a type without fields, and on a field with fields", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model @unique {
            id: ID!
          }
        `)
      ).toThrow(/@unique on the type Product needs fields/);

      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Product @model {
            id: ID!
            sku: String! @unique(fields: ["sku"])
          }
        `)
      ).toThrow(/@unique on Product.sku takes no fields/);
    });

    it("rejects table directives on a type that is not stored", () => {
      expect(() =>
        createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
          type Rate @model @clientOnly {
            id: ID!
            code: String! @unique
          }
        `)
      ).toThrow(/@index and @unique apply to dsqlbase tables.*Rate is not one/);
    });

    it("does not declare the directives without the dsqlbase plugin", () => {
      expect(() =>
        createTransformer().transform(/* GraphQL */ `
          type Product @model {
            id: ID!
            sku: String! @unique
          }
        `)
      ).toThrow(/Unknown directive "@unique"/);
    });
  });
});

describe("DsqlBaseUtilsPlugin @embedded", () => {
  it("keeps an embedded type as an object type, without the directive", () => {
    const { schema } = createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
      type Money @embedded {
        amount: Float!
        currency: String!
      }

      type Product @model {
        id: ID!
        price: Money
      }
    `);

    expect(schema).toMatch(/type Money \{\s+amount: Float!\s+currency: String!\s+\}/);
    expect(schema).toMatch(/input MoneyInput \{\s+amount: Float!\s+currency: String!\s+\}/);
    expect(schema).not.toContain("embedded");
    expect(schema).not.toContain("gqlbase_sortable");
  });

  it("orders by an embedded field's members", () => {
    const { schema } = createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
      type Money @embedded {
        amount: Float!
      }

      type Product @model {
        id: ID!
        price: Money
      }
    `);

    expect(schema).toMatch(
      /input ProductOrderByInput \{\s+id: SortDirection\s+price: MoneyOrderByInput\s+\}/
    );
  });

  it("is not declared without the dsqlbase plugin", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Money @embedded {
          amount: Float!
        }
      `)
    ).toThrow(/embedded/);
  });

  it("rejects a type that is both a model and embedded", () => {
    expect(() =>
      createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
        type Money @model @embedded {
          id: ID!
          amount: Float!
        }
      `)
    ).toThrow(/cannot be both @model and @embedded/);
  });

  it("rejects an id on an embedded type", () => {
    expect(() =>
      createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
        type Money @embedded {
          id: ID!
          amount: Float!
        }
      `)
    ).toThrow(/Money.id cannot be on an @embedded type/);
  });

  it("rejects a relation on an embedded type", () => {
    expect(() =>
      createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
        type Vendor @model {
          id: ID!
        }

        type Money @embedded {
          amount: Float!
          vendor: Vendor @belongsTo
        }
      `)
    ).toThrow(/Money.vendor cannot be on an @embedded type/);
  });

  it("rejects an embedded type that contains itself", () => {
    expect(() =>
      createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
        type Link @embedded {
          value: Int
          next: Inner
        }

        type Inner @embedded {
          back: Link
        }
      `)
    ).toThrow(/Link > Inner > Link/);
  });

  it("allows a list of itself, which is a document", () => {
    expect(() =>
      createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
        type Part @embedded {
          name: String
          parts: [Part]
        }
      `)
    ).not.toThrow();
  });
});
