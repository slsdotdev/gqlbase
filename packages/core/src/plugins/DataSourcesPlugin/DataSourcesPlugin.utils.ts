import { Kind } from "graphql";
import type { DataSourceOptions, TransformerOptions } from "../../context/index.js";
import { ObjectNode } from "../../definition/index.js";
import { isModel } from "../ModelPlugin/index.js";
import { isClientOnly } from "../UtilitiesPlugin/index.js";

export const DataSourceDirective = {
  DATA_SOURCE: "dataSource",
} as const;

/** The enum of data source names, generated from `options.dataSources`. */
export const DATA_SOURCE_ENUM = "DataSource";

export interface DataSource {
  name: string;
  type: string;
}

/**
 * Whether a model is stored, so it is in a data source: a `@model` that is not `@clientOnly`.
 */
export const isStoredModel = (node: ObjectNode): boolean => {
  return isModel(node) && !isClientOnly(node);
};

/**
 * The data source a model is in: the one named by `@dataSource(name:)`, or the default source. `null` for a type that is
 * not stored, and when `options.dataSources` declares no source: then every capability plugin handles every stored model.
 *
 * Reads the `@dataSource` directive, so call it before `cleanup` (generators run before cleanup).
 */
export const getDataSource = (
  node: ObjectNode,
  options: Readonly<Pick<TransformerOptions, "dataSources">>
): DataSource | null => {
  if (!isStoredModel(node)) {
    return null;
  }

  const value = node.getDirective(DataSourceDirective.DATA_SOURCE)?.getArgument("name")?.value;
  const entries = Object.entries(options.dataSources);
  const [name, source] =
    value?.kind === Kind.ENUM
      ? (entries.find(([key]) => key === value.value) ?? [])
      : (entries.find(([, candidate]) => candidate.default) ?? []);

  if (!name || !source) {
    return null;
  }

  return { name, type: source.type };
};

/**
 * Whether a capability plugin that stores models of `type` handles this model: a stored model whose source has that type,
 * or any stored model when no data source is declared.
 */
export const isInDataSourceType = (
  node: ObjectNode,
  options: Readonly<Pick<TransformerOptions, "dataSources">>,
  type: string
): boolean => {
  if (!isStoredModel(node)) {
    return false;
  }

  return (
    Object.keys(options.dataSources).length === 0 || getDataSource(node, options)?.type === type
  );
};

/**
 * The problems with a data sources config, as messages.
 */
export const validateDataSourceOptions = (
  dataSources: Readonly<Record<string, DataSourceOptions>>
): string[] => {
  const errors: string[] = [];
  const defaults = Object.keys(dataSources).filter((name) => dataSources[name].default);

  if (defaults.length > 1) {
    errors.push(`Only one data source can be the default; ${defaults.join(", ")} are.`);
  }

  for (const [name, source] of Object.entries(dataSources)) {
    if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(name) || ["true", "false", "null"].includes(name)) {
      errors.push(`Data source "${name}" is not a valid GraphQL enum value.`);
    }

    if (typeof source.type !== "string" || !source.type) {
      errors.push(`Data source ${name} has no type.`);
    }
  }

  return errors;
};
