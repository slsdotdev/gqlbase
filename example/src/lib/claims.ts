import { Unauthorized } from "@middy-appsync/graphql";
import { isCognito } from "@middy-appsync/graphql/utils";
import type { AppSyncIdentity } from "aws-lambda";
import { dsql } from "./dsql";

// The tenancy claims of the caller, read from the Cognito token. A client derived with them fills the claims on every
// write and filters by them on every read, nested joins included.

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

/** A client scoped to the calling user, for the `user` scope. */
export const userDb = (identity: AppSyncIdentity) => dsql.$identityClaims(userClaims(identity));

/** A client scoped to the caller's vendor, for the `vendor` scope. */
export const vendorDb = (identity: AppSyncIdentity) => dsql.$identityClaims(vendorClaims(identity));

/**
 * A client with every claim the caller has, for a lookup whose table is known only at runtime: none for a caller without
 * a Cognito identity. A table needing a claim the caller lacks throws `TenancyError` when the query is built.
 */
export const callerDb = (identity: AppSyncIdentity | null) => {
  if (!identity || !isCognito(identity)) {
    return dsql;
  }

  const vendorId: unknown = identity.claims["custom:vendor_id"];

  return typeof vendorId === "string"
    ? dsql.$identityClaims({ userId: identity.sub, vendorId })
    : dsql.$identityClaims({ userId: identity.sub });
};
