import { createLogger } from "@gqlbase/shared/logger";
import { CliOptions, resolveConfig } from "./config/resolveConfig.js";
import { debouncePromise } from "./watch/debouncePromise.js";
import { createTransform } from "./transform/index.js";
import { Watcher } from "./watch/watcher.js";

export async function run(source: string | undefined, options: CliOptions) {
  const mainLogger = createLogger("cli", options.verbose ? "debug" : "info");
  let watcher: Watcher | null = null;

  try {
    mainLogger.info("Running CLI");
    mainLogger.debug("Received CLI options\n\n", { source, ...options });

    const config = await resolveConfig({ source, ...options });

    mainLogger.debug("Resolved configuration\n\n", config);

    const sources = Array.isArray(config.source) ? config.source : [config.source];

    const transform = createTransform({
      outputDirectory: config.output,
      plugins: config.plugins ?? [],
      logger: mainLogger,
      transform: config.transform,
    });

    if (!config.watch) {
      // A single run: a failed transform must fail the command.
      await transform(sources);
      return;
    }

    // Watch mode keeps going after a failed run; the debounced runner logs the error.
    const runTransform = debouncePromise(async () => transform(sources), 100);
    const { start } = await import("./watch/watcher.js");

    watcher = await start({
      paths: sources,
      transform: runTransform,
      logger: mainLogger,
      ignored: [config.output],
    });

    runTransform();
  } catch (error) {
    mainLogger.error("Exit with error: ", error);
    watcher?.close();
    process.exit(1);
  }
}
