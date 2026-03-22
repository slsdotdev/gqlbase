import { defineConfig } from "@gqlbase/cli/config";
import { basePreset } from "@gqlbase/plugins/base";
import { relayPreset } from "@gqlbase/plugins/relay";

export default defineConfig({
  source: "src/schema/**/*.graphql",
  output: "generated",
  plugins: [basePreset(), relayPreset()],
});
