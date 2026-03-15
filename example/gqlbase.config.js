import { defineConfig } from "@gqlbase/cli/config";

export default defineConfig({
  schema: "src/schema/**/*.graphql",
  output: "generated",
  verbose: true,
});
