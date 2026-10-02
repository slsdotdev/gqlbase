import { createQueryResolver, createResolver, defineResolvers } from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";
import { allOf } from "../lib/filter";
import { DEFAULT_PAGE_SIZE, toConnection } from "../lib/connection";

type CategoryWhere = NonNullable<Parameters<typeof dsql.categories.findMany>[0]["where"]>;

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
    const first = args.first ?? DEFAULT_PAGE_SIZE;
    const rows = await dsql.categories.findMany({
      where: allOf<CategoryWhere>(
        { parentId: { exists: false } },
        args.after ? { id: { gt: args.after } } : null
      ),
      orderBy: { id: "asc" },
      limit: first + 1,
    });

    return toConnection(rows, first);
  },
});

export default defineResolvers(viewer, viewerCategories);
