import { createLogger, Logger } from "@gqlbase/shared/logger";
import { createTransformer, IPluginFactory } from "@gqlbase/core";
import { definitionFromFiles } from "@gqlbase/shared/definition";

export interface TransformParams {
  sources: string[];
  outputDirectory: string;
  plugins: (IPluginFactory | IPluginFactory[])[];
  logger?: Logger;
}

export async function transform(params: TransformParams) {
  const logger = params.logger ?? createLogger("transform");
  const startTime = performance.now();
  logger.debug("Starting transformation");
  logger.debug("Input sources", params.sources);

  const transformer = createTransformer({
    outputDirectory: params.outputDirectory,
    plugins: params.plugins,
    logger,
  });

  const definition = definitionFromFiles(params.sources);

  logger.debug("Parsed GraphQL definition\n\n");
  logger.debug(definition);

  const output = transformer.transform(definition);

  logger.success(`Transformation completed in  ${Math.floor(performance.now() - startTime)}ms`);
  logger.debug("Transformation output\n\n", output);
}
