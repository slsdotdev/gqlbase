import { beforeAll, describe, expect, it } from "vitest";
import { dsql, migrate } from "../src/lib/dsql";
import { execute } from "./appsync";

const CREATE = /* GraphQL */ `
  mutation Create($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
    }
  }
`;

const UPDATE = /* GraphQL */ `
  mutation Update($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      id
    }
  }
`;

const input = { name: "Herbs", slug: "herbs", sortOrder: 1 };

describe("field visibility", () => {
  let id: string;

  beforeAll(async () => {
    await migrate();

    const result = await execute<{ createCategory: { id: string } }>(CREATE, {
      variables: { input },
    });

    id = result.data?.createCategory.id ?? "";
  });

  describe("@readOnly", () => {
    it("is returned", async () => {
      const result = await execute(
        /* GraphQL */ `
          query Get($id: ID!) {
            getCategory(id: $id) {
              createdAt
              isArchived
            }
          }
        `,
        { variables: { id } }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        getCategory: { createdAt: expect.any(String), isArchived: false },
      });
    });

    it("is not accepted on create or update", async () => {
      const created = await execute(CREATE, {
        variables: { input: { ...input, slug: "herbs-2", isArchived: true } },
      });
      const updated = await execute(UPDATE, { variables: { input: { id, isArchived: true } } });

      expect(created.errors?.[0]?.message).toMatch(/"isArchived" is not defined/);
      expect(updated.errors?.[0]?.message).toMatch(/"isArchived" is not defined/);
    });
  });

  describe("@serverOnly", () => {
    it("is not queryable", async () => {
      const result = await execute(
        /* GraphQL */ `
          query Get($id: ID!) {
            getCategory(id: $id) {
              deletedAt
            }
          }
        `,
        { variables: { id } }
      );

      expect(result.errors?.[0]?.message).toMatch(/Cannot query field "deletedAt"/);
    });

    it("is not accepted on create or update", async () => {
      const created = await execute(CREATE, {
        variables: { input: { ...input, slug: "herbs-3", deletedAt: new Date().toISOString() } },
      });
      const updated = await execute(UPDATE, {
        variables: { input: { id, deletedAt: new Date().toISOString() } },
      });

      expect(created.errors?.[0]?.message).toMatch(/"deletedAt" is not defined/);
      expect(updated.errors?.[0]?.message).toMatch(/"deletedAt" is not defined/);
    });
  });

  describe("@writeOnly", () => {
    it("is accepted on create and stored", async () => {
      const result = await execute<{ createCategory: { id: string } }>(CREATE, {
        variables: { input: { ...input, slug: "herbs-4", importRef: "legacy-42" } },
      });

      expect(result.errors).toBeUndefined();

      const row = await dsql.categories.findOne({
        where: { id: result.data?.createCategory.id },
      });

      expect(row?.importRef).toBe("legacy-42");
    });

    it("is accepted on update", async () => {
      const result = await execute(UPDATE, { variables: { input: { id, importRef: "legacy-7" } } });

      expect(result.errors).toBeUndefined();

      const row = await dsql.categories.findOne({ where: { id } });
      expect(row?.importRef).toBe("legacy-7");
    });

    it("is not queryable", async () => {
      const result = await execute(
        /* GraphQL */ `
          query Get($id: ID!) {
            getCategory(id: $id) {
              importRef
            }
          }
        `,
        { variables: { id } }
      );

      expect(result.errors?.[0]?.message).toMatch(/Cannot query field "importRef"/);
    });
  });

  describe("@clientOnly", () => {
    it("is not accepted on create", async () => {
      const result = await execute(
        /* GraphQL */ `
          mutation Create($input: CreateProductInput!) {
            createProduct(input: $input) {
              id
            }
          }
        `,
        { variables: { input: { reviewCount: 3 } } }
      );

      expect(result.errors?.map((error) => error.message).join("\n")).toMatch(
        /"reviewCount" is not defined/
      );
    });
  });

  describe("unused definitions", () => {
    it("are not in the schema", async () => {
      const result = await execute(/* GraphQL */ `
        query Types {
          sortDirection: __type(name: "SortDirection") {
            name
          }
          searchResult: __type(name: "SearchResult") {
            name
          }
          category: __type(name: "Category") {
            name
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        sortDirection: null,
        searchResult: null,
        category: { name: "Category" },
      });
    });
  });

  describe("@serverOnly type", () => {
    it("is not in the schema, and neither are its operations or the fields that return it", async () => {
      const result = await execute<{
        importJob: unknown;
        category: { fields: { name: string }[] };
        query: { fields: { name: string }[] };
      }>(/* GraphQL */ `
        query Types {
          importJob: __type(name: "ImportJob") {
            name
          }
          category: __type(name: "Category") {
            fields {
              name
            }
          }
          query: __type(name: "Query") {
            fields {
              name
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.importJob).toBeNull();
      expect(result.data?.category.fields.map((field) => field.name)).not.toContain("lastImport");
      expect(result.data?.query.fields.map((field) => field.name)).not.toContain("getImportJob");
    });

    it("is stored and linked by the server", async () => {
      const job = await dsql.importJobs.create({
        data: { source: "legacy-csv", status: "done", startedAt: new Date().toISOString() },
        return: true as const,
      });

      await dsql.categories.update({ where: { id }, set: { lastImportId: job?.id } });

      const row = await dsql.categories.findOne({ where: { id } });
      expect(row?.lastImportId).toBe(job?.id);
    });
  });

  describe("@clientOnly model", () => {
    it("has read operations answered by its resolver", async () => {
      const result = await execute<{
        listExchangeRates: { edges: { node: { currency: string } }[] };
      }>(/* GraphQL */ `
        query Rates {
          listExchangeRates {
            edges {
              node {
                currency
                rate
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.listExchangeRates.edges.map((edge) => edge.node.currency)).toEqual([
        "EUR",
        "GBP",
        "USD",
      ]);
    });

    it("has no write operations and no table", async () => {
      const result = await execute<{ mutation: { fields: { name: string }[] } }>(/* GraphQL */ `
        query Mutations {
          mutation: __type(name: "Mutation") {
            fields {
              name
            }
          }
        }
      `);

      const names = result.data?.mutation.fields.map((field) => field.name);

      expect(names).toContain("createCategory");
      expect(names?.some((name) => name.includes("ExchangeRate"))).toBe(false);
      expect("exchangeRates" in dsql).toBe(false);
    });
  });

  describe("@clientOnly type", () => {
    it("is queryable but not accepted on create", async () => {
      const result = await execute<{ input: { inputFields: { name: string }[] } }>(
        /* GraphQL */ `
          query Stats($id: ID!) {
            getCategory(id: $id) {
              stats {
                productCount
              }
            }
            input: __type(name: "CreateCategoryInput") {
              inputFields {
                name
              }
            }
          }
        `,
        { variables: { id } }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data).toMatchObject({ getCategory: { stats: null } });
      expect(result.data?.input.inputFields.map((field) => field.name)).not.toContain("stats");
    });
  });
});
