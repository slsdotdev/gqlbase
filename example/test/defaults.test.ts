import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../src/lib/dsql";
import { cognitoIdentity, execute } from "./appsync";

const CREATE_CATEGORY = /* GraphQL */ `
  mutation Create($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      isArchived
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_CATEGORY = /* GraphQL */ `
  mutation Update($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      createdAt
      updatedAt
    }
  }
`;

const CREATE_SAVED_SEARCH = /* GraphQL */ `
  mutation Create($input: CreateSavedSearchInput!) {
    createSavedSearch(input: $input) {
      notifyOnNewResults
    }
  }
`;

interface Category {
  id: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

describe("column defaults", () => {
  let created: Category | undefined;

  beforeAll(async () => {
    await migrate();

    const result = await execute<{ createCategory: Category }>(CREATE_CATEGORY, {
      variables: { input: { name: "Herbs", slug: "herbs-defaults", sortOrder: 1 } },
    });

    created = result.data?.createCategory;
  });

  it("fills @defaultNow and @default(value:) columns a create leaves out", () => {
    expect(created?.isArchived).toBe(false);
    expect(created?.createdAt).toEqual(expect.any(String));
    expect(created?.updatedAt).toBe(created?.createdAt);
  });

  it("runs the onUpdate hook on every update", async () => {
    // Timestamps have millisecond precision: let one pass.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = await execute<{ updateCategory: { createdAt: string; updatedAt: string } }>(
      UPDATE_CATEGORY,
      { variables: { input: { id: created?.id, name: "Fresh herbs" } } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.updateCategory.createdAt).toBe(created?.createdAt);
    expect(Date.parse(result.data?.updateCategory.updatedAt ?? "")).toBeGreaterThan(
      Date.parse(created?.updatedAt ?? "")
    );
  });

  it("makes a defaulted field optional on create, and fills it", async () => {
    const result = await execute<{ createSavedSearch: { notifyOnNewResults: boolean } }>(
      CREATE_SAVED_SEARCH,
      {
        variables: { input: { query: "honey", filters: {} } },
        identity: cognitoIdentity(randomUUID()),
      }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.createSavedSearch.notifyOnNewResults).toBe(false);
  });
});
