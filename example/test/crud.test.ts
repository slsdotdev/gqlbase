import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../src/lib/dsql";
import { execute } from "./appsync";

const CATEGORY_FIELDS = /* GraphQL */ `
  fragment CategoryFields on Category {
    id
    name
    slug
    description
    sortOrder
    isArchived
    createdAt
    updatedAt
  }
`;

describe("model CRUD", () => {
  let id: string;

  beforeAll(async () => {
    await migrate();
  });

  it("creates a model and returns it", async () => {
    const result = await execute<{ createCategory: { id: string } }>(
      /* GraphQL */ `
        mutation Create($input: CreateCategoryInput!) {
          createCategory(input: $input) {
            ...CategoryFields
          }
        }
        ${CATEGORY_FIELDS}
      `,
      { variables: { input: { name: "Vegetables", slug: "vegetables", sortOrder: 1 } } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.createCategory).toMatchObject({
      name: "Vegetables",
      slug: "vegetables",
      description: null,
      sortOrder: 1,
      isArchived: false,
    });

    id = result.data?.createCategory.id ?? "";
    expect(id).toEqual(expect.any(String));
  });

  it("accepts a client-provided id on create", async () => {
    const clientId = "0b6a1d4e-5f1c-4c2a-9a55-0d1a2b3c4d5e";

    const result = await execute(
      /* GraphQL */ `
        mutation Create($input: CreateCategoryInput!) {
          createCategory(input: $input) {
            id
          }
        }
      `,
      { variables: { input: { id: clientId, name: "Fruit", slug: "fruit", sortOrder: 2 } } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ createCategory: { id: clientId } });
  });

  it("gets a model by id", async () => {
    const result = await execute(
      /* GraphQL */ `
        query Get($id: ID!) {
          getCategory(id: $id) {
            id
            name
          }
        }
      `,
      { variables: { id } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ getCategory: { id, name: "Vegetables" } });
  });

  it("updates only the fields provided", async () => {
    const result = await execute(
      /* GraphQL */ `
        mutation Update($input: UpdateCategoryInput!) {
          updateCategory(input: $input) {
            name
            slug
            description
          }
        }
      `,
      { variables: { input: { id, description: "Seasonal vegetables" } } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      updateCategory: {
        name: "Vegetables",
        slug: "vegetables",
        description: "Seasonal vegetables",
      },
    });
  });

  it("clears a nullable field set to null", async () => {
    const result = await execute(
      /* GraphQL */ `
        mutation Update($input: UpdateCategoryInput!) {
          updateCategory(input: $input) {
            name
            description
          }
        }
      `,
      { variables: { input: { id, description: null } } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ updateCategory: { name: "Vegetables", description: null } });
  });

  it("rejects null for a required field on update and leaves the row unchanged", async () => {
    const result = await execute(
      /* GraphQL */ `
        mutation Update($input: UpdateCategoryInput!) {
          updateCategory(input: $input) {
            name
          }
        }
      `,
      { variables: { input: { id, name: null, description: "Not written" } } }
    );

    expect(result.errors?.[0]?.extensions?.errorType).toBe("ValidationError");
    expect(result.errors?.[0]?.message).toMatch(/name/);

    const row = await execute(
      /* GraphQL */ `
        query Get($id: ID!) {
          getCategory(id: $id) {
            name
            description
          }
        }
      `,
      { variables: { id } }
    );

    expect(row.data).toEqual({ getCategory: { name: "Vegetables", description: null } });
  });

  it("enforces @constraint on create", async () => {
    const result = await execute(
      /* GraphQL */ `
        mutation Create($input: CreateCategoryInput!) {
          createCategory(input: $input) {
            id
          }
        }
      `,
      { variables: { input: { name: "Bad slug", slug: "Not A Slug", sortOrder: 9 } } }
    );

    expect(result.errors?.[0]?.extensions?.errorType).toBe("ValidationError");
    expect(result.errors?.[0]?.message).toMatch(/slug/);
  });

  it("lists models as a connection", async () => {
    const result = await execute<{
      listCategories: { edges: { node: { name: string } }[] };
    }>(/* GraphQL */ `
      query List {
        listCategories {
          edges {
            cursor
            node {
              name
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(result.data?.listCategories.edges.map((edge) => edge.node.name).sort()).toEqual([
      "Fruit",
      "Vegetables",
    ]);
  });

  it("deletes a model and returns it", async () => {
    const deleted = await execute(
      /* GraphQL */ `
        mutation Delete($id: ID!) {
          deleteCategory(id: $id) {
            id
          }
        }
      `,
      { variables: { id } }
    );

    expect(deleted.errors).toBeUndefined();
    expect(deleted.data).toEqual({ deleteCategory: { id } });

    const result = await execute(
      /* GraphQL */ `
        query Get($id: ID!) {
          getCategory(id: $id) {
            id
          }
        }
      `,
      { variables: { id } }
    );

    expect(result.data).toEqual({ getCategory: null });
  });

  it("rejects a create input that is missing a required field", async () => {
    const result = await execute(
      /* GraphQL */ `
        mutation Create($input: CreateCategoryInput!) {
          createCategory(input: $input) {
            id
          }
        }
      `,
      { variables: { input: { name: "No slug", sortOrder: 3 } } }
    );

    expect(result.errors?.[0]?.message).toMatch(/slug/);
  });
});
