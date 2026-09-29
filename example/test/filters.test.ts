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
    expect(await names({ slug: { ne: "produce" } })).toEqual([
      "Apples",
      "Apricots",
      "Beets",
      "Carrots",
    ]);
    expect(await names({ name: { in: ["Apples", "Carrots"] } })).toEqual(["Apples", "Carrots"]);
  });

  it("filters strings by prefix and substring", async () => {
    expect(await names({ name: { beginsWith: "Ap" } })).toEqual(["Apples", "Apricots"]);
    expect(await names({ name: { contains: "rro" } })).toEqual(["Carrots"]);
    expect(await names({ name: { notContains: "p" } })).toEqual(["Beets", "Carrots", "Produce"]);
  });

  it("filters numbers by range", async () => {
    expect(await names({ sortOrder: { gt: 2 } })).toEqual(["Beets", "Carrots"]);
    expect(await names({ sortOrder: { ge: 3 } })).toEqual(["Beets", "Carrots"]);
    expect(await names({ sortOrder: { lt: 1 } })).toEqual(["Produce"]);
    expect(await names({ sortOrder: { le: 1 } })).toEqual(["Apples", "Produce"]);
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
    expect(await names({ and: [{ name: { beginsWith: "A" } }, { sortOrder: { ge: 2 } }] })).toEqual(
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
      { variables: { id: rootId, filter: { sortOrder: { ge: 3 } } } }
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
});
