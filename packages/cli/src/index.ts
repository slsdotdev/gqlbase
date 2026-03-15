import { cac } from "cac";
import { readFileSync } from "node:fs";
import { parseConfig } from "./config/index.js";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url)).toString()
);

const cli = cac("gqlbase");

cli
  .option("-c, --config [file]", "Path to configuration file")
  .option("-o, --output [dir]", "Output directory for generated artifacts")
  .option("-v, --verbose", "Enable verbose logging");

cli
  .command("[...schema]", "Transform a GraphQL schema")
  .action(async (schema: string[], options) => {
    const config = await parseConfig({
      configFile: options.config,
      schema: schema.length > 0 ? schema : undefined,
      output: options.output,
      verbose: options.verbose,
    });

    console.log("Transforming schema with config:", config);
    // Here you would add the logic to perform the transformation using the GraphQLTransformer
  });

cli
  .command("watch [...schema]", "Watch GraphQL schema files for changes and transform them")
  .alias("dev")
  .action(async (schema: string) => {
    console.log(`Watching schema files: ${schema}`);
    // Here you would add the logic to watch the specified files for changes and perform the transformation when they change
  });

cli.help();
cli.version(version);

export { cli };
