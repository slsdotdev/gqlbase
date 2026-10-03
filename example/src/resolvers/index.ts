import { defineResolvers } from "@middy-appsync/graphql";
import category from "./category";
import exchangeRate from "./exchangeRate";
import integration from "./integration";
import ledgerEntry from "./ledgerEntry";
import operatingSchedule from "./operatingSchedule";
import product from "./product";
import savedSearch from "./savedSearch";
import search from "./search";
import user from "./user";
import vendorPayout from "./vendorPayout";
import viewer from "./viewer";

export const resolvers = defineResolvers(
  category,
  exchangeRate,
  integration,
  ledgerEntry,
  operatingSchedule,
  product,
  savedSearch,
  search,
  user,
  vendorPayout,
  viewer
);
