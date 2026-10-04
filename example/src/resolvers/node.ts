import { createQueryResolver, defineResolvers, Unauthorized } from "@middy-appsync/graphql";
import { decodeGlobalId, TenancyError } from "dsqlbase";
import { callerDb, vendorClaims } from "../lib/claims";
import { INTEGRATION_NODE_KEY, integrationsService } from "../lib/integrations";
import type { Node } from "../../generated/appsync/middy-appsync.types";

// Tables whose type is not in the public schema: their ids are global too, but `node` must not reach them.
const hidden = new Set(["importJobs"]);

// The id names its node: an integration is the integrations service's, anything else a dsqlbase table, read through
// a client scoped to the caller, so another tenant's row is a miss, and a node in a scope whose claim the caller lacks is
// unauthorized. A malformed id throws.
const node = createQueryResolver({
  fieldName: "node",
  resolve: async ({ args, identity }) => {
    const { key } = decodeGlobalId(args.id);

    if (hidden.has(key)) {
      return null;
    }

    if (key === INTEGRATION_NODE_KEY) {
      const record = await integrationsService.find(args.id, vendorClaims(identity).vendorId);

      return record && { ...record, __typename: "Integration" as const };
    }

    const row = await callerDb(identity)
      .$findByGlobalId({ id: args.id })
      .catch((error: unknown) => {
        throw error instanceof TenancyError ? new Unauthorized() : error;
      });

    // `__typename` comes from the table's meta; the spread does not narrow the row union, hence the cast.
    return row && ({ ...row, __typename: row.$$meta.__typename } as Node);
  },
});

export default defineResolvers(node);
