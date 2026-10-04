import { randomUUID } from "node:crypto";
import { encodeGlobalId, isGlobalId } from "dsqlbase";
import type { Integration } from "../../generated/appsync/middy-appsync.types";

// A record as the service stores it: the API type plus the vendorId claim.
type IntegrationRecord = Integration & { vendorId: string };

/**
 * A stand-in for the integrations service, which owns the `integrations` data source: there is no table, so resolvers
 * call the service instead of dsqlbase. A real client would send these over the service's own transport.
 */
const records = new Map<string, IntegrationRecord>();

// The node key its ids carry: `Integration.id` is a GUID, and the service, not dsqlbase, hands the ids out.
export const INTEGRATION_NODE_KEY = "integrations";

const globalId = (id?: string | null) =>
  id && isGlobalId(id) ? id : encodeGlobalId(INTEGRATION_NODE_KEY, { id: id ?? randomUUID() });

export const integrationsService = {
  create: async (data: Omit<IntegrationRecord, "id"> & { id?: string | null }) => {
    const record = { ...data, id: globalId(data.id) };

    records.set(record.id, record);

    return record;
  },
  find: async (id: string, vendorId: string) => {
    const record = records.get(id);

    return record?.vendorId === vendorId ? record : null;
  },
  list: async (vendorId: string) => {
    return [...records.values()].filter((record) => record.vendorId === vendorId);
  },
};
