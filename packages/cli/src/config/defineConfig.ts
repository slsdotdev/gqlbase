import { Config } from "./config.js";

export function defineConfig<T extends Partial<Config>>(config: T): T {
  return config;
}
