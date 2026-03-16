import { defineConfig } from "@gqlbase/cli/config";
import { modelPlugin } from "@gqlbase/plugins/base";

export default defineConfig({
  schema: "src/**/*.graphql",
  output: "generated",
  verbose: false,
  watch: true,
  plugins: [modelPlugin()],
});
