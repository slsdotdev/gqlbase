import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { dsql, migrate } from "../src/lib/dsql";
import { cognitoIdentity, execute } from "./appsync";

const CREATE_CATEGORY = /* GraphQL */ `
  mutation Create($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
    }
  }
`;

const LIST_CATEGORIES = /* GraphQL */ `
  query List {
    listCategories {
      edges {
        node {
          id
          parent {
            id
          }
        }
      }
    }
  }
`;

const NODE = /* GraphQL */ `
  query Node($id: ID!) {
    node(id: $id) {
      __typename
      id
      ... on Category {
        name
      }
      ... on OperatingSchedule {
        dayOfWeek
      }
    }
  }
`;

const CREATE_SCHEDULE = /* GraphQL */ `
  mutation Create($input: CreateOperatingScheduleInput!) {
    createOperatingSchedule(input: $input) {
      id
    }
  }
`;

interface NodeResult { node: { __typename: string; id: string; name?: string; dayOfWeek?: string } }

describe("global ids", () => {
  let rootId: string;
  let childId: string;

  beforeAll(async () => {
    await migrate();

    const root = await execute<{ createCategory: { id: string } }>(CREATE_CATEGORY, {
      variables: { input: { name: "Produce", slug: "produce", sortOrder: 0 } },
    });

    rootId = root.data?.createCategory.id ?? "";

    const child = await dsql.categories.create({
      data: {
        name: "Greens",
        slug: "greens",
        sortOrder: 1,
        parentId: rootId,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      return: true as const,
    });

    childId = child?.id ?? "";
  });

  it("returns ids that name their model", () => {
    expect(rootId).toMatch(/^guid:/);
  });

  it("reads a node by id, typed by its model", async () => {
    const result = await execute<NodeResult>(NODE, { variables: { id: rootId } });

    expect(result.errors).toBeUndefined();
    expect(result.data?.node).toEqual({ __typename: "Category", id: rootId, name: "Produce" });
  });

  it("gives a row and its relations the same id", async () => {
    const result = await execute<{
      listCategories: { edges: { node: { id: string; parent: { id: string } | null } }[] };
    }>(LIST_CATEGORIES);

    const child = result.data?.listCategories.edges.find((edge) => edge.node.id === childId);

    expect(result.errors).toBeUndefined();
    expect(child?.node.parent?.id).toBe(rootId);
  });

  it("returns null for a row that does not exist", async () => {
    await dsql.categories.delete({ where: { id: childId } });

    const result = await execute<NodeResult>(NODE, { variables: { id: childId } });

    expect(result.errors).toBeUndefined();
    expect(result.data?.node).toBeNull();
  });

  it("rejects an id that is not a global id", async () => {
    const result = await execute(NODE, { variables: { id: randomUUID() } });

    expect(result.errors?.[0]?.message).toBeDefined();
  });

  it("does not reach a model outside the public schema", async () => {
    const job = await dsql.importJobs.create({
      data: { source: "legacy-csv", status: "SUCCEEDED", startedAt: new Date().toISOString() },
      return: true as const,
    });

    const result = await execute<NodeResult>(NODE, { variables: { id: job?.id ?? "" } });

    expect(result.errors).toBeUndefined();
    expect(result.data?.node).toBeNull();
  });

  describe("in a tenancy scope", () => {
    let farm: string;
    let scheduleId: string;

    beforeAll(async () => {
      farm = randomUUID();

      const result = await execute<{ createOperatingSchedule: { id: string } }>(CREATE_SCHEDULE, {
        variables: {
          input: {
            dayOfWeek: "MONDAY",
            timeRange: { opensAt: "08:00", closesAt: "14:00" },
            isActive: true,
          },
        },
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": farm }),
      });

      scheduleId = result.data?.createOperatingSchedule.id ?? "";
    });

    it("reads the caller's own node", async () => {
      const result = await execute<NodeResult>(NODE, {
        variables: { id: scheduleId },
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": farm }),
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node).toMatchObject({
        __typename: "OperatingSchedule",
        dayOfWeek: "MONDAY",
      });
    });

    it("returns null for another tenant's node", async () => {
      const result = await execute<NodeResult>(NODE, {
        variables: { id: scheduleId },
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": randomUUID() }),
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node).toBeNull();
    });

    it("rejects a caller without the scope's claim", async () => {
      const result = await execute(NODE, {
        variables: { id: scheduleId },
        identity: cognitoIdentity(randomUUID()),
      });

      expect(result.errors?.[0]?.message).toMatch(/Unauthorized/);
    });
  });
});
