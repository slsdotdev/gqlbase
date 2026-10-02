import { beforeAll, describe, expect, it } from "vitest";
import { dsql, migrate } from "../src/lib/dsql";
import { execute } from "./appsync";

const LIST = /* GraphQL */ `
  query List(
    $filter: CategoryFilterInput
    $orderBy: CategoryOrderByInput
    $first: Int
    $after: String
  ) {
    listCategories(filter: $filter, orderBy: $orderBy, first: $first, after: $after) {
      edges {
        node {
          name
          sortOrder
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface ListResult {
  listCategories: {
    edges: { node: { name: string; sortOrder: number } }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

describe("orderBy", () => {
  let rootId: string;

  beforeAll(async () => {
    await migrate();

    const now = new Date().toISOString();
    const timestamps = { createdAt: now, updatedAt: now, isArchived: false };

    const root = await dsql.categories.create({
      data: { name: "Pantry", slug: "pantry", sortOrder: 0, ...timestamps },
      return: true as const,
    });

    rootId = root?.id ?? "";

    const children = [
      { name: "Kale", slug: "kale-2", sortOrder: 2 },
      { name: "Beans", slug: "beans", sortOrder: 5 },
      { name: "Kale", slug: "kale-1", sortOrder: 1 },
      { name: "Rice", slug: "rice", sortOrder: 3 },
    ];

    for (const child of children) {
      await dsql.categories.create({ data: { ...child, parentId: rootId, ...timestamps } });
    }
  });

  const list = async (variables: Record<string, unknown>) => {
    const result = await execute<ListResult>(LIST, { variables });

    expect(result.errors).toBeUndefined();
    return result.data?.listCategories;
  };

  const rows = (connection: ListResult["listCategories"] | undefined) =>
    connection?.edges.map((edge) => `${edge.node.name} ${edge.node.sortOrder}`);

  it("orders by one field, in either direction", async () => {
    expect(rows(await list({ orderBy: { sortOrder: "desc" } }))).toEqual([
      "Beans 5",
      "Rice 3",
      "Kale 2",
      "Kale 1",
      "Pantry 0",
    ]);
  });

  it("orders by two fields, by the order the input type declares them", async () => {
    const expected = ["Beans 5", "Kale 1", "Kale 2", "Pantry 0", "Rice 3"];

    // CategoryOrderByInput declares name before sortOrder, so name decides first, whatever the
    // order the client writes the keys in.
    expect(rows(await list({ orderBy: { name: "asc", sortOrder: "asc" } }))).toEqual(expected);
    expect(rows(await list({ orderBy: { sortOrder: "asc", name: "asc" } }))).toEqual(expected);
    expect(rows(await list({ orderBy: { name: "asc", sortOrder: "desc" } }))).toEqual([
      "Beans 5",
      "Kale 2",
      "Kale 1",
      "Pantry 0",
      "Rice 3",
    ]);
  });

  it("orders by a @readOnly field", async () => {
    const result = await list({ orderBy: { createdAt: "asc" }, filter: { name: { eq: "Kale" } } });
    expect(result?.edges).toHaveLength(2);
  });

  it("pages through an ordered list with first and after", async () => {
    const firstPage = await list({ orderBy: { sortOrder: "desc" }, first: 2 });

    expect(rows(firstPage)).toEqual(["Beans 5", "Rice 3"]);
    expect(firstPage?.pageInfo.hasNextPage).toBe(true);

    const secondPage = await list({
      orderBy: { sortOrder: "desc" },
      first: 2,
      after: firstPage?.pageInfo.endCursor,
    });

    expect(rows(secondPage)).toEqual(["Kale 2", "Kale 1"]);
  });

  it("filters and orders a @hasMany connection", async () => {
    const result = await execute<{
      getCategory: { children: { edges: { node: { slug: string } }[] } };
    }>(
      /* GraphQL */ `
        query Children($id: ID!) {
          getCategory(id: $id) {
            children(filter: { name: { eq: "Kale" } }, orderBy: { sortOrder: desc }, first: 1) {
              edges {
                node {
                  slug
                }
              }
            }
          }
        }
      `,
      { variables: { id: rootId } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.getCategory.children.edges.map((edge) => edge.node.slug)).toEqual([
      "kale-2",
    ]);
  });

  it("filters and orders a @hasMany on a type that is not stored", async () => {
    const result = await execute<{
      viewer: { categories: { edges: { node: { name: string } }[] } };
    }>(/* GraphQL */ `
      query {
        viewer {
          categories(filter: { name: { beginsWith: "P" } }, orderBy: { name: desc }) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(result.data?.viewer.categories.edges.map((edge) => edge.node.name)).toEqual(["Pantry"]);
  });

  it("rejects a field that cannot be sorted", async () => {
    const result = await execute(LIST, { variables: { orderBy: { parent: "asc" } } });

    expect(result.errors?.[0]?.message).toMatch(/parent/);
  });
});
