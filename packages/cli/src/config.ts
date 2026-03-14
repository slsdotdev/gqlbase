import { existsSync } from "node:fs";
import path from "node:path";

export const DEFAULT_CONFIG_FILES = [
  "gqlbase.config.ts",
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

export const loadConfigFile = async (filePath?: string) => {
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
  }
};
