import { createPluginFactory } from "../createPluginFactory.js";
import { type ITransformerContext } from "../../context/index.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { isDirectiveDefinitionNode } from "../../definition/index.js";
import { collectPublicDefinitions } from "./SchemaGeneratorPlugin.utils.js";

/**
 * Prints the output schema to `schema.graphql`.
 *
 * Before printing, it removes every definition that nothing public reaches (see `collectPublicDefinitions`): unused enums, inputs, unions and scalars, and leftover `@gqlbase_internal` definitions, which are never reachable. It runs in `output`, once every plugin has cleaned up, and the later `output` hooks (the AppSync schema) print the same pruned document. Directive definitions are kept; the plugins that own them remove them.
 */

export class SchemaGeneratorPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("SchemaGeneratorPlugin", context);
  }

  private _removeUnreachableDefinitions() {
    const { document } = this.context;
    const reached = collectPublicDefinitions(this.context);

    for (const node of [...document.definitions.values()]) {
      if (!isDirectiveDefinitionNode(node) && !reached.has(node.name)) {
        document.removeNode(node.name);
      }
    }
  }

  public output() {
    this._removeUnreachableDefinitions();

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
