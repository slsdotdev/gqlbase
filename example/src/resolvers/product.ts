import { createResolver, defineResolvers, GraphQLError } from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";

// The @computed fields of Product have their own resolvers, so the resolver that returns a product
// (search, a relation, …) leaves them out.

const reviewCount = createResolver({
  typeName: "Product",
  fieldName: "reviewCount",
  resolve: async ({ source }) => {
    const reviews = await dsql.reviews.findMany({ where: { productId: source.id } });

    return reviews.length;
  },
});

const averageRating = createResolver({
  typeName: "Product",
  fieldName: "averageRating",
  resolve: async ({ source }) => {
    const reviews = await dsql.reviews.findMany({ where: { productId: source.id } });

    if (!reviews.length) {
      return null;
    }

    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  },
});

const startingPrice = createResolver({
  typeName: "Product",
  fieldName: "startingPrice",
  resolve: async ({ source }) => {
    const variants = await dsql.productVariants.findMany({ where: { productId: source.id } });
    const [first, ...rest] = variants.map((variant) => variant.price);

    // Semantically non-null: a product without variants has no price, which is an error.
    if (!first) {
      throw new GraphQLError(`Product ${source.id} has no variants.`);
    }

    return rest.reduce(
      (lowest, price) => (Number(price.amount) < Number(lowest.amount) ? price : lowest),
      first
    );
  },
});

export default defineResolvers(reviewCount, averageRating, startingPrice);
