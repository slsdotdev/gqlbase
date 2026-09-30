import { IPluginFactory } from "./IPluginFactory.js";
import { internalPlugin } from "./InternalUtilsPlugin/index.js";
import { utilsPlugin } from "./UtilitiesPlugin/index.js";
import { interfaceUtilsPlugin } from "./InterfaceUtilsPlugin/index.js";
import { scalarsPlugin } from "./ScalarsPlugin/index.js";
import { rfcFeaturesPlugin } from "./RfcFeaturesPlugin/index.js";
import { modelPlugin } from "./ModelPlugin/index.js";
import { relationPlugin } from "./RelationsPlugin/index.js";
import { schemaGeneratorPlugin } from "./SchemaGeneratorPlugin/index.js";
import { modelTypesGeneratorPlugin } from "./ModelTypesGeneratorPlugin/index.js";

/**
 * The plugins every transformer registers, in order, before the configured ones. They are always present, so any plugin may rely on them and import their helpers.
 */

export function corePlugins(): IPluginFactory[] {
  return [
    internalPlugin(),
    utilsPlugin(),
    interfaceUtilsPlugin(),
    scalarsPlugin(),
    rfcFeaturesPlugin(),
    modelPlugin(),
    relationPlugin(),
    schemaGeneratorPlugin(),
    modelTypesGeneratorPlugin(),
  ];
}
