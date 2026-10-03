import { createQueryResolver, createResolver, defineResolvers } from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";
import { withoutNulls } from "../lib/filter";
import { orderOf, pageOf, toConnection } from "../lib/connection";

// Viewer is not stored: the root field returns an empty object, and every relation on it is
// resolved here, without a key.
const viewer = createQueryResolver({
  fieldName: "viewer",
  resolve: () => ({}),
});

const viewerCategories = createResolver({
  typeName: "Viewer",
  fieldName: "categories",
  resolve: async ({ args }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.categories.findMany({
      where: { and: [{ parentId: { exists: false } }, withoutNulls(args.filter) ?? {}] },
      orderBy: orderOf(args.orderBy),
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

export default defineResolvers(viewer, viewerCategories);
