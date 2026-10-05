import { query, mutation, object, defineResolvers } from "@middy-appsync/graphql";
import { vendorClaims } from "../lib/claims";
import { pageOf, toConnection } from "../lib/connection";
import { integrationsService } from "../lib/integrations";
import { validate } from "../lib/validation";
import { CreateIntegrationInputSchema } from "../../generated/zod/schema.validators";

// Integration is in the `integrations` data source: the resolvers call the service, not dsqlbase. It is still in the
// `vendor` scope, so vendorId is a claim.
const getIntegration = query({
  getIntegration: async ({ args, identity }) => {
    return await integrationsService.find(args.id, vendorClaims(identity).vendorId);
  },
});

const listIntegrations = query({
  listIntegrations: async ({ args, identity }) => {
    const { first, offset, limit } = pageOf(args);
    const records = await integrationsService.list(vendorClaims(identity).vendorId);

    return toConnection(records.slice(offset, offset + limit), first, offset);
  },
});

const createIntegration = mutation({
  createIntegration: async ({ args, identity }) => {
    const input = validate(CreateIntegrationInputSchema, args.input);

    return await integrationsService.create({ ...input, ...vendorClaims(identity) });
  },
});

// A relation across data sources: the key is a column of the ledger table, the integration is a service record.
const integration = object("LedgerEntry", {
  integration: async ({ source, identity }) => {
    if (!source.integrationId) {
      return null;
    }

    return await integrationsService.find(source.integrationId, vendorClaims(identity).vendorId);
  },
});

export default defineResolvers(getIntegration, listIntegrations, createIntegration, integration);
