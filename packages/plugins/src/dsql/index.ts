import { dsqlbaseSchemaGeneratorPlugin } from "./DsqlBaseSchemaGeneratorPlugin/index.js";
import type { DsqlBaseSchemaGeneratorPluginOptions } from "./DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.utils.js";

export type {
  DsqlBaseSchemaGeneratorPluginOptions,
  ScalarConfig as DsqlBaseScalarConfig,
} from "./DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.utils.js";

/**
 * Registers the dsqlbase schema generator.
 *
 * @param options - `scalarMap` maps a scalar to a column (`{ type, dataType, options? }`, where `dataType` is a `dsqlbase/schema` builder or `safeint`); `emitOutput` returns the content as `output.dsqlBaseSchema`.
 */
export function dsqlbase(options: DsqlBaseSchemaGeneratorPluginOptions = {}) {
  return [dsqlbaseSchemaGeneratorPlugin(options)];
}
