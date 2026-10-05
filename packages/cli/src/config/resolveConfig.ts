import { access, constants } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ConfigurationError } from "@gqlbase/shared/errors";
import { stripUndef } from "@gqlbase/shared/utils";
import { Config, DEFAULT_CONFIG } from "./config.js";

export interface CliOptions {
  config?: string;
  output?: string;
  verbose?: boolean;
  watch?: boolean;
}

export const DEFAULT_CONFIG_FILES = [
  "gqlbase.config.js",
  "gqlbase.config.mjs",
  "gqlbase.config.cjs",
] as const;

const fileExists = async (filePath: string) => {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const resolveConfigFilePath = async (filePath?: string): Promise<string> => {
  if (filePath) {
    const resolved = path.resolve(process.cwd(), filePath);

    if (!(await fileExists(resolved))) {
      throw new ConfigurationError(`Configuration file not found: ${resolved}`);
    }

    return resolved;
  }

  for (const configFile of DEFAULT_CONFIG_FILES) {
    const resolved = path.resolve(process.cwd(), configFile);

    if (await fileExists(resolved)) {
      return resolved;
    }
  }

  throw new ConfigurationError(
    `No configuration file found. Create one of ${DEFAULT_CONFIG_FILES.join(", ")} or pass one with --config.`
  );
};

export const loadConfigFile = async (filePath?: string): Promise<Partial<Config>> => {
  const resolvedFilePath = await resolveConfigFilePath(filePath);
  let module: { default?: Partial<Config> };

  try {
    // A file URL, so absolute Windows paths import too.
    module = await import(pathToFileURL(resolvedFilePath).href);
  } catch (error) {
    throw new ConfigurationError(`Failed to load configuration file ${resolvedFilePath}.`, {
      cause: error,
    });
  }

  if (!module.default) {
    throw new ConfigurationError(
      `Configuration file ${resolvedFilePath} has no default export. Export the config with \`export default defineConfig({ ... })\`.`
    );
  }

  return module.default;
};

export interface CliOverrides extends CliOptions {
  source: string | undefined;
}

export async function resolveConfig(
  overrides: CliOverrides = { source: undefined }
): Promise<Config> {
  const configFromFile = await loadConfigFile(overrides.config);

  return {
    ...DEFAULT_CONFIG,
    ...configFromFile,
    ...stripUndef(overrides),
  } as Config;
}
