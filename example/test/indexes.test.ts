import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { dsql, dsqlUnscoped, migrate } from "../src/lib/dsql";
import { execute } from "./appsync";

const CREATE_CATEGORY = /* GraphQL */ `
  mutation Create($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
    }
  }
`;

const timestamps = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

// The vendorId claim comes from the client the product is created with.
const product = (slug: string) => ({
  name: slug,
  slug,
  status: "DRAFT" as const,
  visibility: "PUBLIC" as const,
  pricingModel: "FIXED" as const,
  imageUrls: [],
  attributes: { allergens: [], dietaryTags: [], certifications: [] },
  tags: [],
  preOrderEnabled: false,
  isArchived: false,
  version: 1,
  reviewId: randomUUID(),
  wishlistItemId: randomUUID(),
  ...timestamps,
});

describe("indexes and unique constraints", () => {
  beforeAll(async () => {
    await migrate();
  });

  describe("@unique on a field", () => {
    let first: { errors?: readonly unknown[] };
    let second: { errors?: readonly unknown[] };

    beforeAll(async () => {
      const input = { name: "Herbs", slug: "herbs", sortOrder: 1 };

      first = await execute(CREATE_CATEGORY, { variables: { input } });
      second = await execute(CREATE_CATEGORY, {
        variables: { input: { ...input, name: "Herbs 2" } },
      });
    });

    it("rejects a second row with the same value", async () => {
      const rows = await dsql.categories.findMany({ where: { slug: "herbs" } });

      expect(first.errors).toBeUndefined();
      expect(second.errors).toHaveLength(1);
      expect(rows).toHaveLength(1);
    });
  });

  describe("unique @index", () => {
    let farm: string;
    let bakery: string;

    beforeAll(async () => {
      farm = randomUUID();
      bakery = randomUUID();

      await dsql
        .$identityClaims({ vendorId: farm })
        .products.create({ data: product("sourdough") });
    });

    it("allows the same value under another leading column", async () => {
      await dsql
        .$identityClaims({ vendorId: bakery })
        .products.create({ data: product("sourdough") });

      const rows = await dsqlUnscoped.products.findMany({ where: { slug: "sourdough" } });

      expect(rows).toHaveLength(2);
    });

    it("rejects a duplicate of every column", async () => {
      await expect(
        dsql.$identityClaims({ vendorId: farm }).products.create({ data: product("sourdough") })
      ).rejects.toThrow();
    });
  });

  describe("@unique(fields:) on a type", () => {
    let reviewId: string;
    let userId: string;

    beforeAll(async () => {
      reviewId = randomUUID();
      userId = randomUUID();

      await dsql
        .$identityClaims({ userId })
        .reviewVotes.create({ data: { reviewId, vote: "HELPFUL", ...timestamps } });
    });

    it("rejects a second row with the same values", async () => {
      await expect(
        dsql
          .$identityClaims({ userId })
          .reviewVotes.create({ data: { reviewId, vote: "HELPFUL", ...timestamps } })
      ).rejects.toThrow();
    });

    it("allows the same value in one of the columns", async () => {
      await dsql
        .$identityClaims({ userId: randomUUID() })
        .reviewVotes.create({ data: { reviewId, vote: "HELPFUL", ...timestamps } });

      const rows = await dsqlUnscoped.reviewVotes.findMany({ where: { reviewId } });

      expect(rows).toHaveLength(2);
    });
  });
});
