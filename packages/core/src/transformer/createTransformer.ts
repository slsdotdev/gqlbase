import { type Logger, createLogger } from "@gqlbase/shared/logger";
import { type IPluginFactory, internalPlugin } from "../plugins/index.js";
import { TransformerContext, type TransformerOptions } from "../context/index.js";
import { GraphQLTransformer } from "./GraphQLTransformer.js";

export interface GraphQLTransformerOptions extends Partial<TransformerOptions> {
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
  const { plugins, logger = createLogger("GraphQLTransformer"), ...transformerOptions } = options;

  const context = new TransformerContext({ logger, ...transformerOptions });

  const internalUtils = internalPlugin().create(context);
  context.registerPlugin(internalUtils);

  for (const pluginEntry of plugins.flat()) {
    const plugin = pluginEntry.create(context);
    context.registerPlugin(plugin);
  }

  return new GraphQLTransformer(context);
}
