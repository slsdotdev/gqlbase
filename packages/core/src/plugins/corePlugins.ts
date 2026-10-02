import type { TransformerOptions } from "../context/index.js";
import { IPluginFactory } from "./IPluginFactory.js";
import { internalPlugin } from "./InternalUtilsPlugin/index.js";
import { utilsPlugin } from "./UtilitiesPlugin/index.js";
import { interfaceUtilsPlugin } from "./InterfaceUtilsPlugin/index.js";
import { scalarsPlugin } from "./ScalarsPlugin/index.js";
import { rfcFeaturesPlugin } from "./RfcFeaturesPlugin/index.js";
import { modelPlugin } from "./ModelPlugin/index.js";
import { tenancyPlugin } from "./TenancyPlugin/index.js";
import { filterPlugin } from "./FilterPlugin/index.js";
import { relationPlugin } from "./RelationsPlugin/index.js";
import { nodeInterfacePlugin } from "./NodeInterfacePlugin/index.js";
import { connectionPlugin } from "./ConnectionPlugin/index.js";
import { schemaGeneratorPlugin } from "./SchemaGeneratorPlugin/index.js";
import { modelTypesGeneratorPlugin } from "./ModelTypesGeneratorPlugin/index.js";

/**
 * The plugins every transformer registers, in order, before the configured ones. Any plugin may rely on the always-on ones and import their helpers. Feature plugins are registered only when their option is on: `RfcFeaturesPlugin` with `options.semanticNullability`, `TenancyPlugin` when `options.tenancy` declares a scope, the Relay plugins with `options.relay`.
 */

export function corePlugins(
  options: Pick<TransformerOptions, "relay" | "semanticNullability" | "tenancy">
): IPluginFactory[] {
  return [
    internalPlugin(),
    utilsPlugin(),
    interfaceUtilsPlugin(),
    scalarsPlugin(),
    ...(options.semanticNullability ? [rfcFeaturesPlugin()] : []),
    modelPlugin(),
    ...(Object.keys(options.tenancy).length ? [tenancyPlugin()] : []),
    filterPlugin(),
    relationPlugin(),
    ...(options.relay ? [nodeInterfacePlugin(), connectionPlugin()] : []),
    schemaGeneratorPlugin(),
    modelTypesGeneratorPlugin(),
  ];
}
