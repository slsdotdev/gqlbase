import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decodeGlobalId } from "dsqlbase";
import { dsqlUnscoped, migrate } from "../src/lib/dsql";
import { cognitoIdentity, execute } from "./appsync";

const CREATE_SAVED_SEARCH = /* GraphQL */ `
  mutation Create($input: CreateSavedSearchInput!) {
    createSavedSearch(input: $input) {
      id
      query
    }
  }
`;

const LIST_SAVED_SEARCHES = /* GraphQL */ `
  query List {
    listSavedSearches {
      edges {
        node {
          query
        }
      }
    }
  }
`;

const CREATE_SCHEDULE = /* GraphQL */ `
  mutation Create($input: CreateOperatingScheduleInput!) {
    createOperatingSchedule(input: $input) {
      id
      dayOfWeek
    }
  }
`;

const LIST_SCHEDULES = /* GraphQL */ `
  query List {
    listOperatingSchedules {
      edges {
        node {
          dayOfWeek
        }
      }
    }
  }
`;

const scheduleInput = (dayOfWeek: string) => ({
  dayOfWeek,
  timeRange: { opensAt: "08:00", closesAt: "14:00" },
  isActive: true,
});

describe("tenancy", () => {
  beforeAll(async () => {
    await migrate();
  });

  describe("claims", () => {
    it("are not in the public types, inputs or filters", async () => {
      const result = await execute<
        Record<string, { fields?: { name: string }[]; inputFields?: { name: string }[] }>
      >(/* GraphQL */ `
        query Types {
          savedSearch: __type(name: "SavedSearch") {
            fields {
              name
            }
          }
          createSavedSearch: __type(name: "CreateSavedSearchInput") {
            inputFields {
              name
            }
          }
          savedSearchFilter: __type(name: "SavedSearchFilterInput") {
            inputFields {
              name
            }
          }
          schedule: __type(name: "OperatingSchedule") {
            fields {
              name
            }
          }
          createSchedule: __type(name: "CreateOperatingScheduleInput") {
            inputFields {
              name
            }
          }
        }
      `);

      const names = Object.values(result.data ?? {}).flatMap((type) =>
        [...(type.fields ?? []), ...(type.inputFields ?? [])].map((field) => field.name)
      );

      expect(result.errors).toBeUndefined();
      expect(names).toContain("query");
      expect(names).toContain("dayOfWeek");
      expect(names).not.toContain("userId");
      expect(names).not.toContain("vendorId");
    });
  });

  describe("user scope", () => {
    let alice: string;
    let bob: string;
    let created: { id: string } | undefined;

    beforeAll(async () => {
      alice = randomUUID();
      bob = randomUUID();

      const result = await execute<{ createSavedSearch: { id: string } }>(CREATE_SAVED_SEARCH, {
        variables: { input: { query: "honey", filters: {}, notifyOnNewResults: false } },
        identity: cognitoIdentity(alice),
      });

      created = result.data?.createSavedSearch;

      await execute(CREATE_SAVED_SEARCH, {
        variables: { input: { query: "kale", filters: {}, notifyOnNewResults: true } },
        identity: cognitoIdentity(bob),
      });
    });

    it("stores the caller's claim on create", async () => {
      const row = await dsqlUnscoped.savedSearches.findOne({ where: { id: created?.id } });

      // The claim is the key to User in some user-scoped table, so it is a users guid in all of them.
      expect(decodeGlobalId(row?.userId ?? "")).toEqual({ key: "users", pk: { id: alice } });
    });

    it("lists only the caller's rows", async () => {
      const result = await execute<{ listSavedSearches: { edges: { node: { query: string } }[] } }>(
        LIST_SAVED_SEARCHES,
        { identity: cognitoIdentity(bob) }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.listSavedSearches.edges.map((edge) => edge.node.query)).toEqual(["kale"]);
    });

    it("rejects a caller without the claim", async () => {
      const result = await execute(LIST_SAVED_SEARCHES);

      expect(result.errors?.[0]?.message).toMatch(/Unauthorized/);
    });
  });

  describe("vendor scope", () => {
    let farm: string;
    let bakery: string;
    let created: { id: string } | undefined;

    beforeAll(async () => {
      farm = randomUUID();
      bakery = randomUUID();

      const result = await execute<{ createOperatingSchedule: { id: string } }>(CREATE_SCHEDULE, {
        variables: { input: scheduleInput("MONDAY") },
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": farm }),
      });

      created = result.data?.createOperatingSchedule;

      await execute(CREATE_SCHEDULE, {
        variables: { input: scheduleInput("SATURDAY") },
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": bakery }),
      });
    });

    it("stores the caller's claim on create", async () => {
      const row = await dsqlUnscoped.operatingSchedules.findOne({ where: { id: created?.id } });

      // The claim is the key to Vendor, so it reads back as a vendor's global id.
      expect(decodeGlobalId(row?.vendorId ?? "")).toEqual({ key: "vendors", pk: { id: farm } });
    });

    it("lists only the caller's rows", async () => {
      const result = await execute<{
        listOperatingSchedules: { edges: { node: { dayOfWeek: string } }[] };
      }>(LIST_SCHEDULES, {
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": bakery }),
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.listOperatingSchedules.edges.map((edge) => edge.node.dayOfWeek)).toEqual([
        "SATURDAY",
      ]);
    });

    it("rejects a caller without the claim", async () => {
      const result = await execute(LIST_SCHEDULES, { identity: cognitoIdentity(randomUUID()) });

      expect(result.errors?.[0]?.message).toMatch(/Unauthorized/);
    });
  });
});
