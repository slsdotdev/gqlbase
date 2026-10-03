import { randomUUID } from "node:crypto";
import type { Integration } from "../../generated/appsync/middy-appsync.types";

// A record as the service stores it: the API type plus the vendorId claim.
type IntegrationRecord = Integration & { vendorId: string };

/**
 * A stand-in for the integrations service, which owns the `integrations` data source: there is no table, so resolvers
 * call the service instead of dsqlbase. A real client would send these over the service's own transport.
 */
const records = new Map<string, IntegrationRecord>();

export const integrationsService = {
  create: async (data: Omit<IntegrationRecord, "id"> & { id?: string | null }) => {
    const record = { ...data, id: data.id ?? randomUUID() };

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
