import { Unauthorized } from "@middy-appsync/graphql";
import { isCognito } from "@middy-appsync/graphql/utils";
import type { AppSyncIdentity } from "aws-lambda";

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
