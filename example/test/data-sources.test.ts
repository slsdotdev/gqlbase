import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import * as tables from "../generated/dsqlbase/schema";
import { dsql, migrate } from "../src/lib/dsql";
import { cognitoIdentity, execute } from "./appsync";

const CREATE_INTEGRATION = /* GraphQL */ `
  mutation Create($input: CreateIntegrationInput!) {
    createIntegration(input: $input) {
      id
      provider
      externalAccountId
    }
  }
`;

const LIST_INTEGRATIONS = /* GraphQL */ `
  query List {
    listIntegrations {
      edges {
        node {
          externalAccountId
        }
      }
    }
  }
`;

const GET_INTEGRATION = /* GraphQL */ `
  query Get($id: ID!) {
    getIntegration(id: $id) {
      externalAccountId
    }
  }
`;

const GET_LEDGER_ENTRY = /* GraphQL */ `
  query Get($id: ID!) {
    getLedgerEntry(id: $id) {
      memo
      integration {
        provider
        externalAccountId
      }
    }
  }
`;

describe("data sources", () => {
  let farm: string;
  let bakery: string;
  let integrationId: string;

  beforeAll(async () => {
    await migrate();

    farm = randomUUID();
    bakery = randomUUID();

    const created = await execute<{ createIntegration: { id: string } }>(CREATE_INTEGRATION, {
      variables: { input: { provider: "QUICKBOOKS", externalAccountId: "qb-farm" } },
      identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": farm }),
    });

    integrationId = created.data?.createIntegration.id ?? "";
  });

  it("emits no table for a model in a service source", () => {
    expect(Object.keys(tables)).not.toContain("integrations");
    expect(Object.keys(tables)).toContain("ledgerEntries");
  });

  it("serves the model's operations from the service", async () => {
    const result = await execute<{ getIntegration: { externalAccountId: string } | null }>(
      GET_INTEGRATION,
      {
        variables: { id: integrationId },
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": farm }),
      }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.getIntegration).toEqual({ externalAccountId: "qb-farm" });
  });

  it("applies the model's tenancy scope in any source", async () => {
    const result = await execute<{
      listIntegrations: { edges: { node: { externalAccountId: string } }[] };
    }>(LIST_INTEGRATIONS, {
      identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": bakery }),
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.listIntegrations.edges).toEqual([]);
  });

  it("validates writes with the generated Zod schema", async () => {
    const result = await execute(CREATE_INTEGRATION, {
      variables: { input: { provider: "XERO", externalAccountId: "" } },
      identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": farm }),
    });

    expect(result.errors?.[0]?.message).toMatch(/externalAccountId/);
  });

  it("stores the key of a relation into another source, and resolves it there", async () => {
    const entry = await dsql.ledgerEntries.create({
      data: {
        amountMinor: 1250,
        currency: "USD",
        bookedOn: "2026-10-03",
        memo: "Synced invoice",
        integrationId,
      },
      return: true as const,
    });

    const result = await execute<{
      getLedgerEntry: {
        memo: string;
        integration: { provider: string; externalAccountId: string } | null;
      };
    }>(GET_LEDGER_ENTRY, {
      variables: { id: entry?.id },
      identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": farm }),
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.getLedgerEntry).toEqual({
      memo: "Synced invoice",
      integration: { provider: "QUICKBOOKS", externalAccountId: "qb-farm" },
    });
  });
});
