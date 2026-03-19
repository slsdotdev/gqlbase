import { utilsPlugin } from "./UtilitiesPlugin/index.js";
import { modelPlugin } from "./ModelPlugin/index.js";
import { relationPlugin } from "./RelationsPlugin/index.js";
import { schemaGeneratorPlugin } from "./SchemaGeneratorPlugin.js";

/**
 * A preset that includes all the base plugins
 *
 * Inludes:
 * - `UtilitiesPlugin`
 * - `ModelPlugin`
 * - `RelationsPlugin`
 * - `SchemaGeneratorPlugin`
 *
 * @returns An array of plugin factories for the base plugins.
 */

export function basePreset() {
  return [utilsPlugin(), modelPlugin(), relationPlugin(), schemaGeneratorPlugin()];
}
