import { isGraphQLFile } from "@gqlbase/shared/files";
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
  /** Directories to ignore, such as the output directory. Relative paths resolve against the cwd. */
  ignored?: string[];
  logger?: Logger;
}

export type Watcher = FSWatcher;

/** Matches the default ignored directories and the given ones, which resolve against the cwd. */
export const createIgnoreMatcher = (ignored: string[] = []) => {
  const directories = ignored.map((dir) => path.resolve(process.cwd(), dir));

  return (file: string) =>
    DEFAULT_IGNORED_DIRS.some((pattern) => pm.isMatch(file, pattern)) ||
    directories.some((dir) => file === dir || file.startsWith(dir + path.sep));
};

export async function start(params: StartWatcherParams): Promise<Watcher> {
  const logger = params.logger?.createChild("watch") ?? createLogger("watch");

  logger.info("Starting file watcher...");

  const watchPaths = params.paths.map((pattern) => {
    const parsed = pm.scan(pattern);
    return path.resolve(process.cwd(), parsed.base || "");
  });

  const watcher = watch(watchPaths, {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ignored: createIgnoreMatcher(params.ignored),
  });

  watcher.on("all", async (type, file) => {
    logger.debug(`File ${type}: ${file}`);

    // Only schema files trigger a run; the writes to the output directory are ignored above.
    if (["add", "change", "unlink"].includes(type) && isGraphQLFile(file)) {
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
