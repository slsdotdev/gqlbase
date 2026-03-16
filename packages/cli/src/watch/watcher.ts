import { createLogger, Logger } from "@gqlbase/shared/logger";
import { FSWatcher } from "chokidar";
import { glob } from "tinyglobby";
import pm from "picomatch";

export const DEFAULT_IGNORED_DIRS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
];

interface StartWatcherParams {
  paths: string[];
  transform: () => void;
  ignored?: string[];
  logger?: Logger;
}

export type Watcher = FSWatcher;

export async function start(params: StartWatcherParams): Promise<Watcher> {
  const logger = params.logger?.createChild("watch") ?? createLogger("watch");

  logger.info("Starting file watcher...");

  const { watch } = await import("chokidar");

  const ignoredPatterns = [...DEFAULT_IGNORED_DIRS, ...(params.ignored ?? [])];

  const watcher = watch(await glob(params.paths), {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ignored: (path) =>
      ignoredPatterns.some((dir) => pm.isMatch(path, dir)) ||
      !params.paths.some((pattern) => pm.isMatch(path, pattern)),
  });

  watcher.on("all", async (type, file) => {
    logger.info(`File ${type}: ${file}`);

    try {
      params.transform();
    } catch (err) {
      logger.error("Error during transformation:", err);
    }
  });

  return watcher;
}
