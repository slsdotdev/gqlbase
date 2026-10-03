import { defineConfig } from "@gqlbase/cli/config";
import { appsyncPreset } from "@gqlbase/plugins";
import { zodSchemaGeneratorPlugin } from "@gqlbase/plugins/zod";
import { dsqlbase } from "@gqlbase/plugins/dsql";

export default defineConfig({
  source: "src/schema",
  output: "generated",
  verbose: false,
  transform: {
    relay: true,
    semanticNullability: true,
    // Vendors own their catalog and orders; users own their carts, orders and account records.
    // Admin-managed and public records (categories, markets) are in no scope.
    tenancy: {
      vendor: { claims: { vendorId: "UUID" } },
      user: { claims: { userId: "UUID" } },
    },
    // Most models are dsqlbase tables. Integrations live in an external service: they get an API, no table.
    dataSources: {
      db: { type: "dsqlbase", default: true },
      integrations: { type: "service" },
    },
  },
  plugins: [
    appsyncPreset({
      middyAppSync: {
        authorizationModes: ["cognito", "iam"],
      },
    }),
    zodSchemaGeneratorPlugin({
      scalars: {
        // ISO 4217 format: three upper-case letters.
        Currency: 'z.string().regex(/^[A-Z]{3}$/, "Expected an ISO 4217 currency code")',
      },
    }),
    dsqlbase(),
  ],
});
