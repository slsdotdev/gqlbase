import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { dsql, migrate } from "../src/lib/dsql";
import { cognitoIdentity, execute } from "./appsync";

const SEARCH = /* GraphQL */ `
  query Search($query: String!) {
    search(query: $query) {
      __typename
      ... on ProductSearchHit {
        product {
          name
          reviewCount
          averageRating
          startingPrice {
            amount
          }
        }
      }
      ... on MarketLocationSearchHit {
        marketLocation {
          name
        }
      }
    }
  }
`;

const GET_PAYOUT = /* GraphQL */ `
  query Get($id: ID!) {
    getVendorPayout(id: $id) {
      status
      lineItemSummary {
        orderNumber
        net {
          amount
        }
      }
    }
  }
`;

const timestamps = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const usd = (amount: string) => ({ amount, currency: "USD" });

const review = (productId: string, rating: number) => ({
  productId,
  rating,
  version: 1,
  orderId: randomUUID(),
  imageUrls: [],
  isVerifiedPurchase: true,
  moderationStatus: "APPROVED" as const,
  helpfulCount: 0,
  reportCount: 0,
  isArchived: false,
  reviewResponseId: randomUUID(),
  reviewReportId: randomUUID(),
  ...timestamps,
});

const variant = (productId: string, sku: string, amount: string) => ({
  productId,
  sku,
  name: sku,
  price: usd(amount),
  isDefault: false,
  sortOrder: 0,
  version: 1,
  cartItemId: randomUUID(),
  lineItemId: randomUUID(),
  ...timestamps,
});

const payout = (status: "PENDING" | "COMPLETED", vendorOrderIds: string[]) => ({
  status,
  vendorOrderIds,
  grossAmount: usd("0"),
  commissionDeducted: usd("0"),
  adjustments: usd("0"),
  netAmount: usd("0"),
  currency: "USD",
  periodStart: timestamps.createdAt,
  periodEnd: timestamps.createdAt,
  lineItemSummary: [] as {
    vendorOrderId: string;
    orderNumber: string;
    gross: { amount: string; currency: string };
    commission: { amount: string; currency: string };
    net: { amount: string; currency: string };
  }[],
  ...timestamps,
});

describe("field resolvers", () => {
  beforeAll(async () => {
    await migrate();
  });

  describe("@computed fields and a union result", () => {
    let result: Awaited<ReturnType<typeof execute<{ search: unknown[] }>>>;

    beforeAll(async () => {
      const productId = randomUUID();

      // A tenant table: rows are written through a client scoped to their claims.
      await dsql.$identityClaims({ vendorId: randomUUID() }).products.create({
        data: {
          id: productId,
          name: "Heirloom tomatoes",
          slug: "heirloom-tomatoes",
          status: "ACTIVE",
          visibility: "PUBLIC",
          pricingModel: "FIXED",
          imageUrls: [],
          attributes: { allergens: [], dietaryTags: [], certifications: [] },
          tags: [],
          preOrderEnabled: false,
          isArchived: false,
          version: 1,
          reviewId: randomUUID(),
          wishlistItemId: randomUUID(),
          ...timestamps,
        },
      });

      // Two shoppers' reviews.
      await dsql
        .$identityClaims({ userId: randomUUID() })
        .reviews.create({ data: review(productId, 4) });
      await dsql
        .$identityClaims({ userId: randomUUID() })
        .reviews.create({ data: review(productId, 5) });
      await dsql.productVariants.create({ data: variant(productId, "tomato-1kg", "6.50") });
      await dsql.productVariants.create({ data: variant(productId, "tomato-500g", "3.75") });

      await dsql.marketLocations.create({
        data: {
          name: "Heirloom Square Market",
          slug: "heirloom-square",
          address: "1 Heirloom Square",
          location: { latitude: 0, longitude: 0 },
          amenities: [],
          acceptingVendors: true,
          isArchived: false,
          ...timestamps,
        },
      });

      result = await execute<{ search: unknown[] }>(SEARCH, { variables: { query: "Heirloom" } });
    });

    it("resolves each union member by its __typename", () => {
      expect(result.errors).toBeUndefined();
      expect(result.data?.search).toContainEqual({
        __typename: "MarketLocationSearchHit",
        marketLocation: { name: "Heirloom Square Market" },
      });
    });

    it("resolves the computed fields the search left out", () => {
      expect(result.data?.search).toContainEqual({
        __typename: "ProductSearchHit",
        product: {
          name: "Heirloom tomatoes",
          reviewCount: 2,
          averageRating: 4.5,
          startingPrice: { amount: "3.75" },
        },
      });
    });
  });

  describe("a stored @computed field", () => {
    let vendorId: string;
    let pending: string;
    let completed: string;

    beforeAll(async () => {
      vendorId = randomUUID();

      const orderId = randomUUID();

      pending = randomUUID();
      completed = randomUUID();

      const vendor = dsql.$identityClaims({ vendorId });

      await vendor.vendorOrders.create({
        data: {
          id: orderId,
          version: 1,
          orderId: randomUUID(),
          referenceNumber: "VO-1001",
          status: "COMPLETED",
          subtotal: usd("40.00"),
          commissionAmount: usd("4.00"),
          vendorNetAmount: usd("36.00"),
          lineItemId: randomUUID(),
          fulfillmentId: randomUUID(),
          ...timestamps,
        },
      });

      const stored = payout("COMPLETED", [orderId]);

      stored.lineItemSummary = [
        {
          vendorOrderId: orderId,
          orderNumber: "VO-1001",
          gross: usd("40.00"),
          commission: usd("4.00"),
          net: usd("35.00"),
        },
      ];

      await vendor.vendorPayouts.create({
        data: { ...payout("PENDING", [orderId]), id: pending },
      });
      await vendor.vendorPayouts.create({ data: { ...stored, id: completed } });
    });

    it("is computed while the payout is open", async () => {
      const result = await execute(GET_PAYOUT, {
        variables: { id: pending },
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": vendorId }),
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.getVendorPayout).toEqual({
        status: "PENDING",
        lineItemSummary: [{ orderNumber: "VO-1001", net: { amount: "36.00" } }],
      });
    });

    it("returns the stored value once the payout completes", async () => {
      const result = await execute(GET_PAYOUT, {
        variables: { id: completed },
        identity: cognitoIdentity(randomUUID(), [], { "custom:vendor_id": vendorId }),
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.getVendorPayout).toEqual({
        status: "COMPLETED",
        lineItemSummary: [{ orderNumber: "VO-1001", net: { amount: "35.00" } }],
      });
    });
  });
});
