import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { dsql, migrate } from "../src/lib/dsql";
import { cognitoIdentity, execute } from "./appsync";

const CREATE_SCHEDULE = /* GraphQL */ `
  mutation Create($input: CreateOperatingScheduleInput!) {
    createOperatingSchedule(input: $input) {
      id
      timeRange {
        opensAt
        closesAt
      }
    }
  }
`;

const LIST_SCHEDULES = /* GraphQL */ `
  query List($filter: OperatingScheduleFilterInput, $orderBy: OperatingScheduleOrderByInput) {
    listOperatingSchedules(filter: $filter, orderBy: $orderBy) {
      edges {
        node {
          dayOfWeek
          timeRange {
            opensAt
            closesAt
          }
        }
      }
    }
  }
`;

const CREATE_SAVED_SEARCH = /* GraphQL */ `
  mutation Create($input: CreateSavedSearchInput!) {
    createSavedSearch(input: $input) {
      id
    }
  }
`;

const LIST_SAVED_SEARCHES = /* GraphQL */ `
  query List($filter: SavedSearchFilterInput) {
    listSavedSearches(filter: $filter) {
      edges {
        node {
          query
        }
      }
    }
  }
`;

interface ScheduleList {
  listOperatingSchedules: {
    edges: { node: { dayOfWeek: string; timeRange: { opensAt: string; closesAt: string } } }[];
  };
}

interface SavedSearchList {
  listSavedSearches: { edges: { node: { query: string } }[] };
}

/**
 * The columns of a table as the database has them: name → nullable.
 */
const columnsOf = async (table: string) => {
  const rows = await dsql.$execute<{ column_name: string; is_nullable: string }>({
    text: "select column_name, is_nullable from information_schema.columns where table_name = $1",
    params: [table],
  });

  return Object.fromEntries(rows.map((row) => [row.column_name, row.is_nullable === "YES"]));
};

describe("embedded objects", () => {
  const identity = cognitoIdentity(randomUUID(), [], { "custom:vendor_id": randomUUID() });

  beforeAll(async () => {
    await migrate();

    for (const [dayOfWeek, opensAt, closesAt] of [
      ["MONDAY", "08:00", "14:00"],
      ["TUESDAY", "10:00", "18:00"],
      ["WEDNESDAY", "06:30", "12:00"],
    ]) {
      await execute(CREATE_SCHEDULE, {
        variables: { input: { dayOfWeek, timeRange: { opensAt, closesAt }, isActive: true } },
        identity,
      });
    }
  });

  it("stores an embedded field as columns of the table, named by field and member", async () => {
    const columns = await columnsOf("operating_schedules");

    expect(columns).toMatchObject({ time_range_opens_at: false, time_range_closes_at: false });
    expect(columns).not.toHaveProperty("time_range");
  });

  it("makes a nullable field's columns nullable, whatever its members require", async () => {
    const columns = await columnsOf("product_variants");

    expect(columns).toMatchObject({
      price_amount: false,
      price_currency: false,
      compare_at_price_amount: true,
      compare_at_price_currency: true,
    });
  });

  it("reads and writes the field as one object", async () => {
    const result = await execute<{
      createOperatingSchedule: { timeRange: { opensAt: string; closesAt: string } };
    }>(CREATE_SCHEDULE, {
      variables: {
        input: {
          dayOfWeek: "SUNDAY",
          timeRange: { opensAt: "09:00", closesAt: "13:00" },
          isActive: false,
        },
      },
      identity,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.createOperatingSchedule.timeRange).toEqual({
      opensAt: "09:00",
      closesAt: "13:00",
    });
  });

  it("filters by a member", async () => {
    const result = await execute<ScheduleList>(LIST_SCHEDULES, {
      variables: { filter: { timeRange: { where: { opensAt: { lt: "08:30" } } } } },
      identity,
    });

    expect(result.errors).toBeUndefined();
    expect(
      result.data?.listOperatingSchedules.edges.map((edge) => edge.node.timeRange.opensAt).sort()
    ).toEqual(["06:30", "08:00"]);
  });

  it("orders by a member", async () => {
    const result = await execute<ScheduleList>(LIST_SCHEDULES, {
      variables: {
        filter: { isActive: { eq: true } },
        orderBy: { timeRange: { closesAt: "desc" } },
      },
      identity,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.listOperatingSchedules.edges.map((edge) => edge.node.dayOfWeek)).toEqual([
      "TUESDAY",
      "MONDAY",
      "WEDNESDAY",
    ]);
  });

  describe("lists", () => {
    const shopper = cognitoIdentity(randomUUID());

    beforeAll(async () => {
      for (const [query, tags] of [
        ["honey", ["sweet", "local"]],
        ["kale", ["greens", "local"]],
        ["cider", null],
      ] as const) {
        await execute(CREATE_SAVED_SEARCH, {
          variables: { input: { query, tags, filters: {}, notifyOnNewResults: false } },
          identity: shopper,
        });
      }
    });

    const queries = async (filter: unknown) => {
      const result = await execute<SavedSearchList>(LIST_SAVED_SEARCHES, {
        variables: { filter },
        identity: shopper,
      });

      expect(result.errors).toBeUndefined();
      return result.data?.listSavedSearches.edges.map((edge) => edge.node.query).sort();
    };

    it("filters a list by the items it contains, all of them", async () => {
      expect(await queries({ tags: { contains: ["local"] } })).toEqual(["honey", "kale"]);
      expect(await queries({ tags: { contains: ["local", "greens"] } })).toEqual(["kale"]);
    });

    it("filters a list by whether it is set", async () => {
      expect(await queries({ tags: { exists: false } })).toEqual(["cider"]);
    });

    it("filters a document by whether it is set", async () => {
      expect(await queries({ filters: { exists: true } })).toEqual(["cider", "honey", "kale"]);
    });
  });
});
