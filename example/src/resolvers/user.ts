import {
  createQueryResolver,
  createResolver,
  defineResolvers,
  Unauthorized,
} from "@middy-appsync/graphql";
import { isCognito } from "@middy-appsync/graphql/utils";
import { dsql } from "../lib/dsql";
import type { GeoPointOwnFields } from "../../generated/schema.types";

export const queryMe = createQueryResolver({
  fieldName: "me",
  resolve: async ({ identity }) => {
    if (!isCognito(identity)) {
      throw new Unauthorized();
    }

    return await dsql.users.findOne({
      where: { id: identity.sub },
    });
  },
});

const userAddresses = createResolver({
  typeName: "User",
  fieldName: "addresses",
  resolve: async ({ source, args }) => {
    const userAddresses = await dsql.addresses.findMany({
      where: { userId: source.id },
      limit: args.first ?? 100,
    });

    // `location` is a nullable group, so its columns are nullable and dsqlbase types every
    // member `| null`. Writes go through GeoPointInput, which sets both or neither, so a present
    // location is complete.
    const edges = userAddresses.map((address) => ({
      cursor: address.id,
      node: { ...address, location: address.location as GeoPointOwnFields | null },
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
    };
  },
});

export default defineResolvers(queryMe, userAddresses);
