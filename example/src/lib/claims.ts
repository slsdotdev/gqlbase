import { Unauthorized } from "@middy-appsync/graphql";
import { isCognito } from "@middy-appsync/graphql/utils";
import type { AppSyncIdentity } from "aws-lambda";
import type * as schema from "../../generated/dsqlbase/schema";

// The tenancy claims of the caller, read from the Cognito token. Every write sets them and every read filters by them,
// until dsqlbase's `$identityClaims` does both.

export const userClaims = (identity: AppSyncIdentity) => {
  if (!isCognito(identity)) {
    throw new Unauthorized();
  }

  return { userId: identity.sub };
};

export const vendorClaims = (identity: AppSyncIdentity) => {
  const vendorId: unknown = isCognito(identity) ? identity.claims["custom:vendor_id"] : undefined;

  if (typeof vendorId !== "string") {
    throw new Unauthorized();
  }

  return { vendorId };
};

// The tenancy scope of each scoped table, by schema alias: what `@scope` says in the source schema. A node lookup names
// its table only at runtime, so it reads the scope from here.
const tableScopes: Partial<Record<keyof typeof schema, "vendor" | "user">> = {
  products: "vendor",
  vendorOrders: "vendor",
  vendorPayouts: "vendor",
  reviewResponses: "vendor",
  vendorMembers: "vendor",
  operatingSchedules: "vendor",
  marketVendorAssignments: "vendor",
  carts: "user",
  orders: "user",
  paymentMethods: "user",
  couponRedemptions: "user",
  reviews: "user",
  reviewVotes: "user",
  wishlists: "user",
  savedSearches: "user",
  addresses: "user",
  userPreferences: "user",
  refreshTokenFamilies: "user",
  verificationTokens: "user",
};

/**
 * The caller's claims for a table's scope, or `undefined` for a table in no scope.
 */
export const scopeClaims = (alias: string, identity: AppSyncIdentity) => {
  const scope = tableScopes[alias as keyof typeof schema];

  if (scope === "vendor") return vendorClaims(identity);
  if (scope === "user") return userClaims(identity);

  return undefined;
};
