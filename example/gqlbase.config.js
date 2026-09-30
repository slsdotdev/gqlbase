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
  },
  plugins: [
    appsyncPreset({
      scalarMappings: {
        Decimal: "String",
      },
      middyAppSync: {
        authorizationModes: ["cognito", "iam"],
      },
    }),
    zodSchemaGeneratorPlugin(),
    dsqlbase(),
  ],
});
