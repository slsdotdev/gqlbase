import { createLogger } from "@gqlbase/shared/logger";
import { CliOptions, resolveConfig } from "./config/resolveConfig.js";
import { debouncePromise } from "./watch/debouncePromise.js";
import { transform } from "./transform/transform.js";
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

    const debouncedTransform = debouncePromise(async () => {
      await transform({
        sources: sources,
        outputDirectory: config.output,
        plugins: config.plugins ?? [],
        logger: mainLogger,
      });
    }, 100);

    if (config.watch) {
      const { start } = await import("./watch/watcher.js");

      watcher = await start({
        paths: sources,
        transform: debouncedTransform,
        logger: mainLogger,
      });
    }

    debouncedTransform();
  } catch (error) {
    mainLogger.error("Exit with error: ", error);
    watcher?.close();
    process.exit(1);
  }
}
