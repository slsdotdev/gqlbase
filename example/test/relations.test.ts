import { beforeAll, describe, expect, it } from "vitest";
import { dsql, migrate } from "../src/lib/dsql";
import { execute } from "./appsync";

const CHILDREN = /* GraphQL */ `
  query Children($id: ID!, $first: Int, $after: String) {
    getCategory(id: $id) {
      name
      children(first: $first, after: $after) {
        edges {
          cursor
          node {
            name
            parent {
              name
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
`;

interface ChildrenResult {
  getCategory: {
    name: string;
    children: {
      edges: { cursor: string; node: { name: string; parent: { name: string } | null } }[];
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string | null;
        endCursor: string | null;
      };
    };
  };
}

describe("relations", () => {
  let rootId: string;
  let leafId: string;

  beforeAll(async () => {
    await migrate();

    const now = new Date().toISOString();
    const timestamps = { createdAt: now, updatedAt: now, isArchived: false };

    const root = await dsql.categories.create({
      data: { name: "Produce", slug: "produce", sortOrder: 0, ...timestamps },
      return: true as const,
    });

    rootId = root?.id ?? "";

    for (const [index, name] of ["Greens", "Roots", "Squash"].entries()) {
      const child = await dsql.categories.create({
        data: { name, slug: name.toLowerCase(), sortOrder: index, parentId: rootId, ...timestamps },
        return: true as const,
      });

      leafId = child?.id ?? "";
    }
  });

  it("resolves @belongsTo to the parent", async () => {
    const result = await execute(
      /* GraphQL */ `
        query Parent($id: ID!) {
          getCategory(id: $id) {
            parent {
              id
              name
            }
          }
        }
      `,
      { variables: { id: leafId } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ getCategory: { parent: { id: rootId, name: "Produce" } } });
  });

  it("resolves @belongsTo to null when there is no parent", async () => {
    const result = await execute(
      /* GraphQL */ `
        query Parent($id: ID!) {
          getCategory(id: $id) {
            parent {
              id
            }
          }
        }
      `,
      { variables: { id: rootId } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ getCategory: { parent: null } });
  });

  it("resolves @hasMany as a connection, with nested relations", async () => {
    const result = await execute<ChildrenResult>(CHILDREN, { variables: { id: rootId } });

    expect(result.errors).toBeUndefined();

    const children = result.data?.getCategory.children;
    expect(children?.edges.map((edge) => edge.node.name).sort()).toEqual([
      "Greens",
      "Roots",
      "Squash",
    ]);
    expect(children?.edges.every((edge) => edge.node.parent?.name === "Produce")).toBe(true);
    expect(children?.pageInfo.hasNextPage).toBe(false);
  });

  it("pages through a @hasMany connection with first and after", async () => {
    const firstPage = await execute<ChildrenResult>(CHILDREN, {
      variables: { id: rootId, first: 2 },
    });

    expect(firstPage.errors).toBeUndefined();

    const first = firstPage.data?.getCategory.children;
    expect(first?.edges).toHaveLength(2);
    expect(first?.pageInfo).toMatchObject({
      hasNextPage: true,
      startCursor: first?.edges[0]?.cursor,
      endCursor: first?.edges[1]?.cursor,
    });

    const secondPage = await execute<ChildrenResult>(CHILDREN, {
      variables: { id: rootId, first: 2, after: first?.pageInfo.endCursor },
    });

    expect(secondPage.errors).toBeUndefined();

    const second = secondPage.data?.getCategory.children;
    expect(second?.edges).toHaveLength(1);
    expect(second?.pageInfo.hasNextPage).toBe(false);

    const names = [...(first?.edges ?? []), ...(second?.edges ?? [])]
      .map((edge) => edge.node.name)
      .sort();
    expect(names).toEqual(["Greens", "Roots", "Squash"]);
  });

  it("resolves a @hasMany on a type that is not stored, without a key", async () => {
    const result = await execute<{
      viewer: { categories: { edges: { node: { name: string } }[] } };
    }>(/* GraphQL */ `
      query Viewer {
        viewer {
          categories {
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

    const names = result.data?.viewer.categories.edges.map((edge) => edge.node.name);
    expect(names).toContain("Produce");
    expect(names).not.toContain("Greens");
  });

  it("filters a @hasMany on a type that is not stored", async () => {
    const result = await execute<{
      viewer: { categories: { edges: { node: { name: string } }[] } };
    }>(/* GraphQL */ `
      query Viewer {
        viewer {
          categories(filter: { slug: { eq: "produce" } }) {
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
    expect(result.data?.viewer.categories.edges.map((edge) => edge.node.name)).toEqual([
      "Produce",
    ]);
  });
});
