import { defineResolvers } from "@middy-appsync/graphql";
import category from "./category";
import exchangeRate from "./exchangeRate";
import ledgerEntry from "./ledgerEntry";
import user from "./user";
import viewer from "./viewer";

export const resolvers = defineResolvers(category, exchangeRate, ledgerEntry, user, viewer);
