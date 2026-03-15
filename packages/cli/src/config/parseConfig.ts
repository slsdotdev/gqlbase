import { existsSync } from "node:fs";
import path from "node:path";
import { Config } from "./defineConfig.js";

export const DEFAULT_CONFIG_FILES = [
  "gqlbase.config.ts",
  "gqlbase.config.js",
  "gqlbase.config.mjs",
  "gqlbase.config.cjs",
] as const;

export const DEFAULT_CONFIG = Object.freeze<Config>({
  schema: "**/*.graphql",
  output: "generated",
  verbose: false,
  watch: false,
});

export interface ConfigOverrides extends Partial<
  Pick<Config, "schema" | "output" | "verbose" | "watch">
> {
  configFile?: string;
}

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

export const loadConfigFile = async (filePath?: string): Promise<Config | null> => {
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

export async function parseConfig(overrides: Partial<ConfigOverrides> = {}): Promise<Config> {
  const configFromFile = await loadConfigFile(overrides.configFile);

  if (!configFromFile) {
    throw new Error(
      "No configuration file found. Please create a configuration file or provide one using the --config option."
    );
  }

  return {
    ...DEFAULT_CONFIG,
    ...configFromFile,
    ...overrides,
  };
}
