import { beforeAll, describe, expect, it } from "vitest";
import { dsql, migrate } from "../src/lib/dsql";
import { execute } from "./appsync";

// Above the int4 maximum (2,147,483,647), the cap that made money `Int` unusable.
const LARGE_AMOUNT = 5_000_000_000_00;

const CREATE_LEDGER_ENTRY = /* GraphQL */ `
  mutation Create($input: CreateLedgerEntryInput!) {
    createLedgerEntry(input: $input) {
      id
      amountMinor
      currency
    }
  }
`;

describe("BigInt and custom scalars", () => {
  let id: string;

  beforeAll(async () => {
    await migrate();
  });

  it("round-trips a BigInt above the int4 range as a number", async () => {
    const result = await execute<{
      createLedgerEntry: { id: string; amountMinor: number; currency: string };
    }>(CREATE_LEDGER_ENTRY, {
      variables: { input: { amountMinor: LARGE_AMOUNT, currency: "EUR" } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.createLedgerEntry).toMatchObject({
      amountMinor: LARGE_AMOUNT,
      currency: "EUR",
    });

    id = result.data?.createLedgerEntry.id ?? "";
  });

  it("stores the value in a bigint column and reads it back as a number", async () => {
    const row = await dsql.ledgerEntries.findOne({ where: { id } });

    expect(row?.amountMinor).toBe(LARGE_AMOUNT);
    expect(typeof row?.amountMinor).toBe("number");
  });

  it("filters BigInt values with number operators", async () => {
    await execute(CREATE_LEDGER_ENTRY, {
      variables: { input: { amountMinor: 1_00, currency: "EUR" } },
    });

    const result = await execute<{
      listLedgerEntries: { edges: { node: { amountMinor: number } }[] };
    }>(
      /* GraphQL */ `
        query List($filter: LedgerEntryFilterInput) {
          listLedgerEntries(filter: $filter) {
            edges {
              node {
                amountMinor
              }
            }
          }
        }
      `,
      { variables: { filter: { amountMinor: { gt: 2_147_483_647 } } } }
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.listLedgerEntries.edges.map((edge) => edge.node.amountMinor)).toEqual([
      LARGE_AMOUNT,
    ]);
  });

  it("rejects a BigInt that is not an integer", async () => {
    const result = await execute(CREATE_LEDGER_ENTRY, {
      variables: { input: { amountMinor: 1.5, currency: "EUR" } },
    });

    expect(result.errors?.[0]?.extensions?.errorType).toBe("ValidationError");
    expect(result.errors?.[0]?.message).toMatch(/amountMinor/);
  });

  it("rejects a currency that is not an ISO 4217 code, through the Zod override", async () => {
    const result = await execute(CREATE_LEDGER_ENTRY, {
      variables: { input: { amountMinor: 1_00, currency: "euro" } },
    });

    expect(result.errors?.[0]?.extensions?.errorType).toBe("ValidationError");
    expect(result.errors?.[0]?.message).toMatch(/ISO 4217/);
  });
});
