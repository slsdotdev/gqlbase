import {
  createMutationResolver,
  createQueryResolver,
  createResolver,
  defineResolvers,
} from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";
import { allOf, toWhere } from "../lib/filter";
import { orderOf, pageOf, toConnection } from "../lib/connection";
import { validate } from "../lib/validation";
import {
  CreateCategoryInputSchema,
  UpdateCategoryInputSchema,
} from "../../generated/zod/schema.validators";

type CategoryWhere = NonNullable<Parameters<typeof dsql.categories.findMany>[0]["where"]>;

const getCategory = createQueryResolver({
  fieldName: "getCategory",
  resolve: async ({ args }) => {
    return await dsql.categories.findOne({ where: { id: args.id } });
  },
});

const listCategories = createQueryResolver({
  fieldName: "listCategories",
  resolve: async ({ args }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.categories.findMany({
      where: allOf<CategoryWhere>(toWhere(args.filter)),
      orderBy: orderOf(args.orderBy),
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

// The name argument is the generated StringFilterInput, referenced from the source schema.
const searchCategories = createQueryResolver({
  fieldName: "searchCategories",
  resolve: async ({ args }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.categories.findMany({
      where: allOf<CategoryWhere>(toWhere({ name: args.name })),
      orderBy: { id: "asc" },
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

const createCategory = createMutationResolver({
  fieldName: "createCategory",
  resolve: async ({ args }) => {
    const now = new Date().toISOString();
    const data = validate(CreateCategoryInputSchema, {
      ...args.input,
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    });

    return await dsql.categories.create({ data, return: true as const });
  },
});

const updateCategory = createMutationResolver({
  fieldName: "updateCategory",
  resolve: async ({ args }) => {
    // Omitted fields stay unchanged, `null` clears a nullable field, and `null` on a required
    // field is rejected by the schema. The client decides; the resolver never drops values.
    const { id, ...set } = validate(UpdateCategoryInputSchema, {
      ...args.input,
      updatedAt: new Date().toISOString(),
    });

    return await dsql.categories.update({ set, where: { id }, return: true as const });
  },
});

const deleteCategory = createMutationResolver({
  fieldName: "deleteCategory",
  resolve: async ({ args }) => {
    return await dsql.categories.delete({ where: { id: args.id }, return: true as const });
  },
});

const categoryParent = createResolver({
  typeName: "Category",
  fieldName: "parent",
  resolve: async ({ source }) => {
    if (!source.parentId) {
      return null;
    }

    return await dsql.categories.findOne({ where: { id: source.parentId } });
  },
});

const categoryChildren = createResolver({
  typeName: "Category",
  fieldName: "children",
  resolve: async ({ source, args }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.categories.findMany({
      where: allOf<CategoryWhere>({ parentId: source.id }, toWhere(args.filter)),
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
  categoryParent,
  categoryChildren
);
