import {
  createMutationResolver,
  createQueryResolver,
  defineResolvers,
} from "@middy-appsync/graphql";
import { userDb } from "../lib/claims";
import { withoutNulls } from "../lib/filter";
import { orderOf, pageOf, toConnection } from "../lib/connection";
import { validate } from "../lib/validation";
import { CreateSavedSearchInputSchema } from "../../generated/zod/schema.validators";

// SavedSearch is in the `user` scope: userId is a claim, never part of the API, and the user's client sets and filters
// it.
const listSavedSearches = createQueryResolver({
  fieldName: "listSavedSearches",
  resolve: async ({ args, identity }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await userDb(identity).savedSearches.findMany({
      where: withoutNulls(args.filter),
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

    return await userDb(identity).savedSearches.create({
      data: input,
      return: true as const,
    });
  },
});

export default defineResolvers(listSavedSearches, createSavedSearch);
