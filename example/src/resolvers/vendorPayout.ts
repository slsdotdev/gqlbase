import { createQueryResolver, createResolver, defineResolvers } from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";
import { vendorClaims } from "../lib/claims";

const getVendorPayout = createQueryResolver({
  fieldName: "getVendorPayout",
  resolve: async ({ args, identity }) => {
    return await dsql.vendorPayouts.findOne({ where: { id: args.id, ...vendorClaims(identity) } });
  },
});

// lineItemSummary is @computed but stored: a completed payout returns its stored summary, any other payout is
// summarised from its vendor orders on every read.
const lineItemSummary = createResolver({
  typeName: "VendorPayout",
  fieldName: "lineItemSummary",
  resolve: async ({ source }) => {
    if (source.status === "COMPLETED" && source.lineItemSummary) {
      return source.lineItemSummary;
    }

    if (!source.vendorOrderIds.length) {
      return [];
    }

    const orders = await dsql.vendorOrders.findMany({
      where: { id: { in: source.vendorOrderIds } },
    });

    return orders.map((order) => ({
      vendorOrderId: order.id,
      orderNumber: order.referenceNumber,
      gross: order.subtotal,
      commission: order.commissionAmount,
      net: order.vendorNetAmount,
    }));
  },
});

export default defineResolvers(getVendorPayout, lineItemSummary);
