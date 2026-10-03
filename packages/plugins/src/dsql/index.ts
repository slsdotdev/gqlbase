import { dsqlbaseSchemaGeneratorPlugin } from "./DsqlBaseSchemaGeneratorPlugin/index.js";
import { dsqlBaseUtilsPlugin } from "./DsqlBaseUtilsPlugin/index.js";
import type { DsqlBaseSchemaGeneratorPluginOptions } from "./DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.utils.js";

export type {
  DsqlBaseSchemaGeneratorPluginOptions,
  ScalarConfig as DsqlBaseScalarConfig,
} from "./DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.utils.js";

export {
  DsqlBaseDirective,
  getIndexes,
  getUniqueConstraints,
  isUnique,
  type DsqlIndex,
  type DsqlIndexColumn,
} from "./DsqlBaseUtilsPlugin/index.js";

/**
 * Registers the dsqlbase plugins: `DsqlBaseUtilsPlugin` (the `@index` and `@unique` directives) and the schema generator.
 *
 * @param options - `scalarMap` maps a scalar to a column (`{ type, dataType, options? }`, where `dataType` is a `dsqlbase/schema` builder or `safeint`); `emitOutput` returns the content as `output.dsqlBaseSchema`.
 */
export function dsqlbase(options: DsqlBaseSchemaGeneratorPluginOptions = {}) {
  return [dsqlBaseUtilsPlugin(), dsqlbaseSchemaGeneratorPlugin(options)];
}
