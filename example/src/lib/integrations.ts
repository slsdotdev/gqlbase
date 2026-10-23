import { randomUUID } from "node:crypto";
import { encodeGlobalId, isGlobalId } from "dsqlbase";
import type { IntegrationOwnFields } from "../../generated/schema.types";
import { IntegrationSchema } from "../../generated/zod/schema.validators";

// A record as the service stores it. The schema types include the vendorId claim; the access token is the service's own,
// so it is not in the schema at all.
type IntegrationRecord = IntegrationOwnFields & { accessToken: string };

// What the service returns: the schema's Integration. `IntegrationSchema` drops the keys it does not declare, so the
// access token never leaves the service, while vendorId, a @serverOnly claim, reaches the resolvers that need it.
const toIntegration = (record: IntegrationRecord) => IntegrationSchema.parse(record);

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
  create: async (data: Omit<IntegrationOwnFields, "id"> & { id?: string | null }) => {
    const record = { ...data, id: globalId(data.id), accessToken: randomUUID() };

    records.set(record.id, record);

    return toIntegration(record);
  },
  find: async (id: string, vendorId: string) => {
    const record = records.get(id);

    return record?.vendorId === vendorId ? toIntegration(record) : null;
  },
  list: async (vendorId: string) => {
    return [...records.values()]
      .filter((record) => record.vendorId === vendorId)
      .map(toIntegration);
  },
};
