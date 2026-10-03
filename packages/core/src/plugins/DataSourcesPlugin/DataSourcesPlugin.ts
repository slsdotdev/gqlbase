import { Kind } from "graphql";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { type ITransformerContext } from "../../context/index.js";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  EnumNode,
  InputValueNode,
  isObjectNode,
  NonNullTypeNode,
  ObjectNode,
} from "../../definition/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { InternalDirective } from "../InternalUtilsPlugin/index.js";
import {
  DATA_SOURCE_ENUM,
  DataSourceDirective,
  isStoredModel,
  validateDataSourceOptions,
} from "./DataSourcesPlugin.utils.js";

/**
 * Data sources: puts each stored model in a store. A model is in the default source, or in the one its `@dataSource`
 * names. Core only records it; capability plugins read it with `getDataSource` and emit the models of the source types
 * they handle (dsqlbase: `type: "dsqlbase"`). Relation keys do not depend on it. Core registers this plugin only when
 * `context.options.dataSources` declares a source.
 *
 * @definition
 * ```graphql
 * enum DataSource { db integrations }   # the keys of options.dataSources
 * directive `@dataSource(name: DataSource!)` on OBJECT
 * ```
 *
 * @example
 * ```graphql
 * # dataSources: { db: { type: "dsqlbase", default: true }, integrations: { type: "service" } }
 *
 * type Vendor `@model` { id: ID! }                                        # in db: a dsqlbase table
 * type Integration `@model` `@dataSource(name: integrations)` { id: ID! }   # in integrations: no table
 * ```
 */
export class DataSourcesPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("DataSourcesPlugin", context);

    const errors = validateDataSourceOptions(context.options.dataSources);

    if (errors.length) {
      throw new TransformerPluginExecutionError(this.name, errors.join("\n"));
    }
  }

  public init() {
    this.context.base
      .addNode(
        EnumNode.create(
          DATA_SOURCE_ENUM,
          undefined,
          [DirectiveNode.create(InternalDirective.INTERNAL)],
          Object.keys(this.context.options.dataSources)
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          DataSourceDirective.DATA_SOURCE,
          undefined,
          ["OBJECT"],
          [
            InputValueNode.create(
              "name",
              undefined,
              undefined,
              NonNullTypeNode.create(DATA_SOURCE_ENUM)
            ),
          ]
        )
      );
  }

  public before() {
    const hasDefault = Object.values(this.context.options.dataSources).some(
      (source) => source.default
    );

    for (const definition of this.context.document.definitions.values()) {
      if (!isObjectNode(definition)) {
        continue;
      }

      const hasDirective = definition.hasDirective(DataSourceDirective.DATA_SOURCE);
      const value = definition
        .getDirective(DataSourceDirective.DATA_SOURCE)
        ?.getArgument("name")?.value;

      // SDL validation does not check argument values, so an undeclared name would be accepted as an enum value.
      if (value?.kind === Kind.ENUM && !(value.value in this.context.options.dataSources)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `${definition.name} has @dataSource(name: ${value.value}), which is not a data source. Declared: ${Object.keys(this.context.options.dataSources).join(", ")}.`
        );
      }

      if (hasDirective && !isStoredModel(definition)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `@dataSource applies to stored models, a @model that is not @clientOnly. ${definition.name} is not one.`
        );
      }

      if (!hasDirective && !hasDefault && isStoredModel(definition)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `${definition.name} is in no data source: it has no @dataSource, and no data source is the default.`
        );
      }
    }
  }

  public match(definition: DefinitionNode): boolean {
    return isObjectNode(definition) && definition.hasDirective(DataSourceDirective.DATA_SOURCE);
  }

  public cleanup(definition: ObjectNode) {
    definition.removeDirective(DataSourceDirective.DATA_SOURCE);
  }

  public after() {
    this.context.document.removeNode(DataSourceDirective.DATA_SOURCE).removeNode(DATA_SOURCE_ENUM);
  }
}

export const dataSourcesPlugin = createPluginFactory(DataSourcesPlugin);
