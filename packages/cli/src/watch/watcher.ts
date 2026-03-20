import { createLogger, Logger } from "@gqlbase/shared/logger";
import { FSWatcher } from "chokidar";
import path from "node:path";
import pm from "picomatch";
import { watch } from "chokidar";

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

  const ignoredPatterns = [...DEFAULT_IGNORED_DIRS, ...(params.ignored ?? [])];

  const watchPaths = params.paths.map((pattern) => {
    const parsed = pm.scan(pattern);
    return path.resolve(process.cwd(), parsed.base || "");
  });

  const watcher = watch(watchPaths, {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ignored: (path) => {
      return ignoredPatterns.some((dir) => pm.isMatch(path, dir));
    },
  });

  watcher.on("all", async (type, file) => {
    // const isMatch = params.paths.some((pattern) => pm.isMatch(file, pattern));
    logger.debug(`File ${type}: ${file}`);

    if (["add", "change", "unlink"].includes(type)) {
      try {
        params.transform();
      } catch (err) {
        logger.error("Error during transformation:", err);
      }
    }
  });

  watcher.on("error", (error) => {
    logger.error("Watcher error:", error);
  });

  return watcher;
}
