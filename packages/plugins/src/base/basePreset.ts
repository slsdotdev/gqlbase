import { utilsPlugin } from "./UtilitiesPlugin/index.js";
import { interfaceUtilsPlugin } from "./InterfaceUtilsPlugin/index.js";
import { scalarsPlugin } from "./ScalarsPlugin/index.js";
import { modelPlugin, OperationType } from "./ModelPlugin/index.js";
import { relationPlugin } from "./RelationsPlugin/index.js";
import { rfcFeaturesPlugin } from "./RfcFeaturesPlugin/index.js";
import { schemaGeneratorPlugin } from "./SchemaGeneratorPlugin.js";
import { modelTypesGeneratorPlugin } from "./ModelTypesGeneratorPlugin/index.js";

/**
 * A preset that includes all the base plugins
 *
 * Inludes:
 * - `UtilitiesPlugin`
 * - `InterfaceUtilsPlugin`
 * - `ScalarsPlugin`
 * - `ModelPlugin`
 * - `RelationsPlugin`
 * - `RfcFeaturesPlugin`
 * - `SchemaGeneratorPlugin`
 * - `ModelTypesGeneratorPlugin`
 *
 * @returns An array of plugin factories for the base plugins.
 */

export function basePreset(config: BasePresetConfig = {}) {
  const { operations } = config;

  return [
    utilsPlugin(),
    interfaceUtilsPlugin(),
    scalarsPlugin(),
    rfcFeaturesPlugin(),
    modelPlugin({ operations }),
    relationPlugin(),
    schemaGeneratorPlugin(),
    modelTypesGeneratorPlugin(),
  ];
}

export interface BasePresetConfig {
  /** Overrides the transformer's `operations` option. */
  operations?: OperationType[];
}
