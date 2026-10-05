import { Logger } from "@gqlbase/shared/logger";
import { createTransformer, IPluginFactory, TransformerOptions } from "@gqlbase/core";
import { definitionFromFiles, ensureOutputDirectoryExists } from "@gqlbase/shared/files";
import { writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

export interface TransformParams {
  outputDirectory: string;
  plugins: (IPluginFactory | IPluginFactory[])[];
  logger: Logger;
  transform?: Partial<TransformerOptions>;
}

export function createTransform(params: TransformParams) {
  params.logger.debug("Creating transformer with plugins");

  const transformer = createTransformer({
    plugins: params.plugins,
    logger: params.logger,
    ...params.transform,
  });

  // The output directory holds generated `.graphql` files, which must never be read back as source.
  const ignore = [`${relative(process.cwd(), resolve(params.outputDirectory))}/**`];

  return async (source: string[]) => {
    params.logger.debug("Starting transformation");
    params.logger.debug("Input sources", source);
    const startTime = performance.now();

    const definition = definitionFromFiles(source, ignore);

    const output = transformer.transform(definition);

    await Promise.all(
      output.files.map(async (file) => {
        ensureOutputDirectoryExists(dirname(resolve(params.outputDirectory, file.path)));
        return writeFile(resolve(params.outputDirectory, file.path), file.content);
      })
    );

    params.logger.success(
      "Transformation completed in " + (performance.now() - startTime).toFixed(2) + "ms"
    );
  };
}
