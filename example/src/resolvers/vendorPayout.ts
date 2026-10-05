import { query, object, defineResolvers } from "@middy-appsync/graphql";
import { vendorDb } from "../lib/claims";

const getVendorPayout = query({
  getVendorPayout: async ({ args, identity }) => {
    return await vendorDb(identity).vendorPayouts.findOne({ where: { id: args.id } });
  },
});

// lineItemSummary is @computed but stored: a completed payout returns its stored summary, any other payout is
// summarised from its vendor orders on every read.
const lineItemSummary = object("VendorPayout", {
  lineItemSummary: async ({ source, identity }) => {
    if (source.status === "COMPLETED" && source.lineItemSummary) {
      return source.lineItemSummary;
    }

    if (!source.vendorOrderIds.length) {
      return [];
    }

    const orders = await vendorDb(identity).vendorOrders.findMany({
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
