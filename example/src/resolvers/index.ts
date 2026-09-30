import { defineResolvers } from "@middy-appsync/graphql";
import category from "./category";
import exchangeRate from "./exchangeRate";
import user from "./user";

export const resolvers = defineResolvers(category, exchangeRate, user);
