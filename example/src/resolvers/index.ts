import { defineResolvers } from "@middy-appsync/graphql";
import category from "./category";
import exchangeRate from "./exchangeRate";
import ledgerEntry from "./ledgerEntry";
import operatingSchedule from "./operatingSchedule";
import savedSearch from "./savedSearch";
import user from "./user";
import viewer from "./viewer";

export const resolvers = defineResolvers(
  category,
  exchangeRate,
  ledgerEntry,
  operatingSchedule,
  savedSearch,
  user,
  viewer
);
