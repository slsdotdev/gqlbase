import { beforeAll, describe, expect, it } from "vitest";
import { dsql, migrate } from "../src/lib/dsql";
import { execute } from "./appsync";

const LIST = /* GraphQL */ `
  query List($filter: CategoryFilterInput) {
    listCategories(filter: $filter) {
      edges {
        node {
          name
        }
      }
    }
  }
`;

interface ListResult {
  listCategories: { edges: { node: { name: string } }[] };
}

describe("list filters", () => {
  let rootId: string;

  beforeAll(async () => {
    await migrate();

    const now = new Date().toISOString();
    const timestamps = { createdAt: now, updatedAt: now, isArchived: false };

    const root = await dsql.categories.create({
      data: { name: "Produce", slug: "produce", sortOrder: 0, ...timestamps },
      return: true as const,
    });

    rootId = root?.id ?? "";

    const children = [
      { name: "Apples", slug: "apples", sortOrder: 1, description: "Crisp and sweet" },
      { name: "Apricots", slug: "apricots", sortOrder: 2, description: null },
      { name: "Beets", slug: "beets", sortOrder: 3, description: "Earthy roots" },
      { name: "Carrots", slug: "carrots", sortOrder: 4, description: null },
    ];

    for (const child of children) {
      await dsql.categories.create({ data: { ...child, parentId: rootId, ...timestamps } });
    }
  });

  const names = async (filter: Record<string, unknown>) => {
    const result = await execute<ListResult>(LIST, { variables: { filter } });

    expect(result.errors).toBeUndefined();
    return result.data?.listCategories.edges.map((edge) => edge.node.name).sort();
  };

  it("filters strings by equality", async () => {
    expect(await names({ name: { eq: "Beets" } })).toEqual(["Beets"]);
    expect(await names({ slug: { neq: "produce" } })).toEqual([
      "Apples",
      "Apricots",
      "Beets",
      "Carrots",
    ]);
    expect(await names({ name: { in: ["Apples", "Carrots"] } })).toEqual(["Apples", "Carrots"]);
  });

  it("filters strings by prefix, suffix and substring", async () => {
    expect(await names({ name: { beginsWith: "Ap" } })).toEqual(["Apples", "Apricots"]);
    expect(await names({ name: { contains: "rro" } })).toEqual(["Carrots"]);
    expect(await names({ name: { endsWith: "ts" } })).toEqual(["Apricots", "Beets", "Carrots"]);
    expect(await names({ not: { name: { contains: "p" } } })).toEqual([
      "Beets",
      "Carrots",
      "Produce",
    ]);
  });

  it("filters numbers by range", async () => {
    expect(await names({ sortOrder: { gt: 2 } })).toEqual(["Beets", "Carrots"]);
    expect(await names({ sortOrder: { gte: 3 } })).toEqual(["Beets", "Carrots"]);
    expect(await names({ sortOrder: { lt: 1 } })).toEqual(["Produce"]);
    expect(await names({ sortOrder: { lte: 1 } })).toEqual(["Apples", "Produce"]);
    expect(await names({ sortOrder: { between: [2, 3] } })).toEqual(["Apricots", "Beets"]);
  });

  it("filters by presence", async () => {
    expect(await names({ description: { exists: true } })).toEqual(["Apples", "Beets"]);
    expect(await names({ description: { exists: false } })).toEqual([
      "Apricots",
      "Carrots",
      "Produce",
    ]);
  });

  it("combines conditions with and, or and not", async () => {
    expect(await names({ and: [{ name: { beginsWith: "A" } }, { sortOrder: { gte: 2 } }] })).toEqual(
      ["Apricots"]
    );
    expect(await names({ or: [{ name: { eq: "Beets" } }, { sortOrder: { eq: 0 } }] })).toEqual([
      "Beets",
      "Produce",
    ]);
    expect(await names({ not: { name: { beginsWith: "A" } } })).toEqual([
      "Beets",
      "Carrots",
      "Produce",
    ]);
  });

  it("filters a @hasMany connection", async () => {
    const result = await execute<{
      getCategory: { children: { edges: { node: { name: string } }[] } };
    }>(
      /* GraphQL */ `
        query Children($id: ID!, $filter: CategoryFilterInput) {
          getCategory(id: $id) {
            children(filter: $filter) {
              edges {
                node {
                  name
                }
              }
            }
          }
        }
      `,
      { variables: { id: rootId, filter: { sortOrder: { gte: 3 } } } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.getCategory.children.edges.map((edge) => edge.node.name).sort()).toEqual([
      "Beets",
      "Carrots",
    ]);
  });

  it("rejects operators the filter input does not declare", async () => {
    const result = await execute(LIST, { variables: { filter: { sortOrder: { contains: 1 } } } });

    expect(result.errors?.[0]?.message).toMatch(/contains/);
  });

  it("accepts a generated filter input referenced from the source schema", async () => {
    const result = await execute<{
      searchCategories: { edges: { node: { name: string } }[] };
    }>(
      /* GraphQL */ `
        query Search($name: StringFilterInput!) {
          searchCategories(name: $name) {
            edges {
              node {
                name
              }
            }
          }
        }
      `,
      { variables: { name: { beginsWith: "Ap" } } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.searchCategories.edges.map((edge) => edge.node.name).sort()).toEqual([
      "Apples",
      "Apricots",
    ]);
  });
});
