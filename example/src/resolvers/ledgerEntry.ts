import { query, mutation, defineResolvers } from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";
import { withoutNulls } from "../lib/filter";
import { orderOf, pageOf, toConnection } from "../lib/connection";
import { validate } from "../lib/validation";
import { CreateLedgerEntryInputSchema } from "../../generated/zod/schema.validators";

const getLedgerEntry = query({
  getLedgerEntry: async ({ args }) => {
    return await dsql.ledgerEntries.findOne({ where: { id: args.id } });
  },
});

const listLedgerEntries = query({
  listLedgerEntries: async ({ args }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.ledgerEntries.findMany({
      where: withoutNulls(args.filter) ?? undefined,
      orderBy: orderOf(args.orderBy),
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

// Currency is checked by the Zod override in gqlbase.config.js; amountMinor by z.number().int().
const createLedgerEntry = mutation({
  createLedgerEntry: async ({ args }) => {
    const data = validate(CreateLedgerEntryInputSchema, args.input);

    return await dsql.ledgerEntries.create({ data, return: true as const });
  },
});

export default defineResolvers(getLedgerEntry, listLedgerEntries, createLedgerEntry);
