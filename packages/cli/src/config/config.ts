import { IPluginFactory } from "@gqlbase/core";

export interface Config {
  /** * The path to the GraphQL schema file(s) to be transformed.
   * This can be a single file or an array of files.
   */
  source: string | string[];

  /**
   * The output directory where the generated artifacts will be saved.
   * If not specified, the output will be printed to the console.
   */
  output: string;

  /**
   * Enable verbose logging for debugging purposes.
   */
  verbose: boolean;

  /**
   * Watch the specified schema files for changes and automatically transform them when they change.
   */
  watch: boolean;

  /**
   * An array of plugin factories to be registered with the transformer.
   */
  plugins: (IPluginFactory | IPluginFactory[])[];
}

export const DEFAULT_CONFIG = Object.freeze<Config>({
  source: "**/*.graphql",
  output: "generated",
  verbose: false,
  watch: false,
  plugins: [],
});
