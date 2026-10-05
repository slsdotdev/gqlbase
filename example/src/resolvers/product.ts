import { object, GraphQLError } from "@middy-appsync/graphql";
import { dsqlUnscoped } from "../lib/dsql";

// The @computed fields of Product have their own resolvers, so the resolver that returns a product
// (search, a relation, …) leaves them out. They summarise every shopper's reviews, so they read unscoped.

const productFields = object("Product", {
  reviewCount: async ({ source }) => {
    const reviews = await dsqlUnscoped.reviews.findMany({ where: { productId: source.id } });

    return reviews.length;
  },
  averageRating: async ({ source }) => {
    const reviews = await dsqlUnscoped.reviews.findMany({ where: { productId: source.id } });

    if (!reviews.length) {
      return null;
    }

    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  },
  startingPrice: async ({ source }) => {
    const variants = await dsqlUnscoped.productVariants.findMany({
      where: { productId: source.id },
    });
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

export default productFields;
