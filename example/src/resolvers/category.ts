import { query, mutation, object, defineResolvers } from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";
import { withoutNulls } from "../lib/filter";
import { orderOf, pageOf, toConnection } from "../lib/connection";
import { validate } from "../lib/validation";
import {
  CreateCategoryInputSchema,
  UpdateCategoryInputSchema,
} from "../../generated/zod/schema.validators";

const getCategory = query({
  getCategory: async ({ args }) => {
    return await dsql.categories.findOne({ where: { id: args.id } });
  },
});

const listCategories = query({
  listCategories: async ({ args }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.categories.findMany({
      where: withoutNulls(args.filter) ?? undefined,
      orderBy: orderOf(args.orderBy),
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

// The name argument is the generated StringFilterInput, referenced from the source schema.
const searchCategories = query({
  searchCategories: async ({ args }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.categories.findMany({
      where: withoutNulls({ name: args.name }),
      orderBy: { id: "asc" },
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

const createCategory = mutation({
  createCategory: async ({ args }) => {
    // The schema checks what the client sent. The timestamps and isArchived are column defaults
    // (@defaultNow, @default), so the table fills them.
    const input = validate(CreateCategoryInputSchema, args.input);

    return await dsql.categories.create({
      data: input,
      return: true as const,
    });
  },
});

const updateCategory = mutation({
  updateCategory: async ({ args }) => {
    // Omitted fields stay unchanged, `null` clears a nullable field, and `null` on a required
    // field is rejected by the schema. The client decides; the resolver never drops values.
    const { id, ...input } = validate(UpdateCategoryInputSchema, args.input);

    // updatedAt is set by its @default(onUpdate:) hook.
    return await dsql.categories.update({
      set: input,
      where: { id },
      return: true as const,
    });
  },
});

const deleteCategory = mutation({
  deleteCategory: async ({ args }) => {
    return await dsql.categories.delete({ where: { id: args.id }, return: true as const });
  },
});

const categoryFields = object("Category", {
  parent: async ({ source }) => {
    if (!source.parentId) {
      return null;
    }

    return await dsql.categories.findOne({ where: { id: source.parentId } });
  },
  children: async ({ source, args }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.categories.findMany({
      where: { and: [{ parentId: source.id }, withoutNulls(args.filter) ?? {}] },
      orderBy: orderOf(args.orderBy),
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

export default defineResolvers(
  getCategory,
  listCategories,
  searchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  categoryFields
);
