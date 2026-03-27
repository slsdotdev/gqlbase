import { defineConfig } from "@gqlbase/cli/config";
import { basePreset, relayPreset, appsyncPreset } from "@gqlbase/plugins";

export default defineConfig({
  source: "src/schema",
  output: "generated",
  verbose: true,
  plugins: [
    basePreset(),
    relayPreset(),
    appsyncPreset({
      scalarMappings: {
        Decimal: "String",
      },
    }),
  ],
});
