import { cac } from "cac";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url)).toString()
);

const cli = cac("gqlbase");

cli
  .option("-c, --config [file]", "Path to configuration file")
  .option("-o, --output [dir]", "Output directory for generated artifacts")
  .option("-v, --verbose", "Enable verbose logging");

cli
  .command("[...files]", "Transform a GraphQL schema")
  .action(async (schema: string, options: { output?: string }) => {
    console.log(`Transforming schema: ${schema}`);
    console.log(process.cwd());
    if (options.output) {
      console.log(`Output will be saved to: ${options.output}`);
    } else {
      console.log("No output file specified, printing to console.");
    }
    // Here you would add the logic to perform the transformation using the GraphQLTransformer
  });

cli
  .command("watch [...files]", "Watch GraphQL schema files for changes and transform them")
  .alias("dev")
  .action(async (schema: string) => {
    console.log(`Watching schema files: ${schema}`);
    // Here you would add the logic to watch the specified files for changes and perform the transformation when they change
  });

cli.help();
cli.version(version);

export { cli };
