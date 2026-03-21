import { utilsPlugin } from "./UtilitiesPlugin/index.js";
import { scalarsPlugin } from "./ScalarsPlugin/index.js";
import { modelPlugin } from "./ModelPlugin/index.js";
import { relationPlugin } from "./RelationsPlugin/index.js";
import { rfcFeaturesPlugin } from "./RfcFeaturesPlugin/index.js";
import { schemaGeneratorPlugin } from "./SchemaGeneratorPlugin.js";
import { modelTypesGeneratorPlugin } from "./ModelTypesGeneratorPlugin/index.js";

/**
 * A preset that includes all the base plugins
 *
 * Inludes:
 * - `UtilitiesPlugin`
 * - `ScalarsPlugin`
 * - `ModelPlugin`
 * - `RelationsPlugin`
 * - `RfcFeaturesPlugin`
 * - `SchemaGeneratorPlugin`
 * - `ModelTypesGeneratorPlugin`
 *
 * @returns An array of plugin factories for the base plugins.
 */

export function basePreset() {
  return [
    utilsPlugin(),
    scalarsPlugin(),
    modelPlugin(),
    relationPlugin(),
    rfcFeaturesPlugin(),
    schemaGeneratorPlugin(),
    modelTypesGeneratorPlugin(),
  ];
}
