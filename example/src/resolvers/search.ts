import { query, defineResolvers } from "@middy-appsync/graphql";
import { dsqlUnscoped } from "../lib/dsql";

// SearchResult is a union: each hit says which member it is with __typename, which the result type requires. Search
// spans every vendor's catalog, so it reads unscoped.
const search = query({
  search: async ({ args }) => {
    const [products, locations] = await Promise.all([
      dsqlUnscoped.products.findMany({ where: { name: { contains: args.query } } }),
      dsqlUnscoped.marketLocations.findMany({ where: { name: { contains: args.query } } }),
    ]);

    return [
      ...products.map((product) => ({
        __typename: "ProductSearchHit" as const,
        product,
        score: 1,
      })),
      ...locations.map((marketLocation) => ({
        __typename: "MarketLocationSearchHit" as const,
        marketLocation,
        score: 1,
      })),
    ];
  },
});

export default defineResolvers(search);
