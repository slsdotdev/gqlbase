import { defineResolvers } from "@middy-appsync/graphql";
import category from "./category";
import user from "./user";

export const resolvers = defineResolvers(category, user);
