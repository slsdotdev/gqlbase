import { cac } from "cac";
import { readFileSync } from "node:fs";
import { run } from "./action.js";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url)).toString()
);

const cli = cac("gqlbase");

cli
  .option("-c, --config [file]", "Path to configuration file")
  .option("-o, --output [dir]", "Output directory for generated artifacts")
  .option("-v, --verbose", "Enable verbose logging")
  .option("-w, --watch", "Watch schema files for changes and automatically transform them");

cli.command("[source]", "Transform a GraphQL schema").action(run);

cli.help();
cli.version(version);

export { cli };
