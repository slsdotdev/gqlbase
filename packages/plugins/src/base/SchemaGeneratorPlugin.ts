import { createPluginFactory, ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import { writeOutputFile } from "@gqlbase/shared/files";

export class SchemaGeneratorPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("SchemaGeneratorPlugin", context);
  }

  public output() {
    const schema = this.context.document.print();
    writeOutputFile(this.context.outputDirectory, "schema.graphql", schema);

    return {};
  }
}

export const schemaGeneratorPlugin = createPluginFactory(SchemaGeneratorPlugin);
