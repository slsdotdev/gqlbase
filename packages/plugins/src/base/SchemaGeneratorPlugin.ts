import { createPluginFactory, ITransformerContext, TransformerPluginBase } from "@gqlbase/core";

export class SchemaGeneratorPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("SchemaGeneratorPlugin", context);
  }

  public output() {
    const schema = this.context.document.print();

    this.context.files.push({
      type: "graphql",
      path: "schema.graphql",
      filename: "schema.graphql",
      content: schema,
    });

    return { schema };
  }
}

export const schemaGeneratorPlugin = createPluginFactory(SchemaGeneratorPlugin);
