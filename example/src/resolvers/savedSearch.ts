import {
  createMutationResolver,
  createQueryResolver,
  defineResolvers,
} from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";
import { userClaims } from "../lib/claims";
import { withoutNulls } from "../lib/filter";
import { orderOf, pageOf, toConnection } from "../lib/connection";
import { validate } from "../lib/validation";
import { CreateSavedSearchInputSchema } from "../../generated/zod/schema.validators";

// SavedSearch is in the `user` scope: userId is a claim, never part of the API.
const listSavedSearches = createQueryResolver({
  fieldName: "listSavedSearches",
  resolve: async ({ args, identity }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.savedSearches.findMany({
      where: { and: [userClaims(identity), withoutNulls(args.filter) ?? {}] },
      orderBy: orderOf(args.orderBy),
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

const createSavedSearch = createMutationResolver({
  fieldName: "createSavedSearch",
  resolve: async ({ args, identity }) => {
    const input = validate(CreateSavedSearchInputSchema, args.input);
    const now = new Date().toISOString();

    return await dsql.savedSearches.create({
      data: { ...input, ...userClaims(identity), createdAt: now, updatedAt: now },
      return: true as const,
    });
  },
});

export default defineResolvers(listSavedSearches, createSavedSearch);
