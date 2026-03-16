import { existsSync } from "node:fs";
import path from "node:path";
import { stripUndef } from "@gqlbase/shared/utils";
import { Config, DEFAULT_CONFIG } from "./config.js";

export interface CliOptions {
  config?: string;
  output?: string;
  verbose?: boolean;
  watch?: boolean;
}

export const DEFAULT_CONFIG_FILES = [
  // "gqlbase.config.ts",
  "gqlbase.config.js",
  "gqlbase.config.mjs",
  "gqlbase.config.cjs",
] as const;

const resolveConfigFilePath = (filePath?: string): string | null => {
  if (filePath) {
    if (!existsSync(path.resolve(process.cwd(), filePath))) {
      return null;
    }

    return path.resolve(process.cwd(), filePath);
  }

  for (const configFile of DEFAULT_CONFIG_FILES) {
    if (existsSync(path.resolve(process.cwd(), configFile))) {
      return path.resolve(process.cwd(), configFile);
    }
  }
  return null;
};

export const loadConfigFile = async (filePath?: string): Promise<Partial<Config> | null> => {
  try {
    const resolvedFilePath = resolveConfigFilePath(filePath);

    if (!resolvedFilePath) {
      console.warn(`No configuration file found. Searched for: ${DEFAULT_CONFIG_FILES.join(", ")}`);

      return null;
    }

    const { default: config } = await import(resolvedFilePath);
    return config;
  } catch (error) {
    console.error(`Failed to load configuration file at ${filePath}:`, error);
    return null;
  }
};

export interface CliOverrides extends CliOptions {
  source: string | undefined;
}

export async function resolveConfig(
  overrides: CliOverrides = { source: undefined }
): Promise<Config> {
  const configFromFile = await loadConfigFile(overrides.config);

  if (!configFromFile) {
    throw new Error(
      "No configuration file found. Please create a configuration file or provide one using the --config option."
    );
  }

  return {
    ...DEFAULT_CONFIG,
    ...configFromFile,
    ...stripUndef(overrides),
  } as Config;
}
