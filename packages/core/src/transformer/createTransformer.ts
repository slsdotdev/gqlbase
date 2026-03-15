import { IPluginFactory } from "../plugins/IPluginFactory.js";
import { TransformerContext } from "../context/TransformerContext.js";
import { GraphQLTransformer } from "./GraphQLTransformer.js";
import { createLogger, Logger } from "@gqlbase/shared/logger";
import { internalPlugin } from "../plugins/InternalUtilsPlugin.js";

export interface GraphQLTransformerOptions {
  /**
   * The output directory where the transformed GraphQL documents or generated code will be saved.
   * @default "generated"
   */
  outputDirectory?: string;

  /**
   * An array of plugin factories to be registered with the transformer.
   */
  plugins: (IPluginFactory | IPluginFactory[])[];

  /** Optional logger instance to be used by the transformer and its plugins. If not provided, a default logger will be created.
   */
  logger?: Logger;
}

/**
 * Creates a new instance of the GraphQLTransformer with the provided options.
 *
 * @param options - The options for configuring the transformer.
 * @return A new instance of the GraphQLTransformer.
 */

export function createTransformer(options: GraphQLTransformerOptions) {
  const { outputDirectory = "generated", plugins } = options;

  const context = new TransformerContext({ outputDirectory });
  const logger = options.logger ?? createLogger("GraphQLTransformer");

  const internalUtils = internalPlugin().create(context);
  context.registerPlugin(internalUtils);

  for (const pluginEntry of plugins.flat()) {
    const plugin = pluginEntry.create(context);
    context.registerPlugin(plugin);
  }

  return new GraphQLTransformer(context, { logger });
}
