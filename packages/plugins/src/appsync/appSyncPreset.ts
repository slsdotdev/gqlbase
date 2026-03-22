import { appSyncUtilsPlugin } from "./AppSyncUtilsPlugin/index.js";
import {
  appSyncSchemaGeneratorPlugin,
  AppSyncSchemaGeneratorPluginOptions,
} from "./AppSyncSchemaGeneratorPlugin/index.js";

interface AppSyncPresetOptions {
  emitFile?: boolean;
  scalarMappings?: AppSyncSchemaGeneratorPluginOptions["scalarMappings"];
}

/**
 * Register AWS AppSync specific features and ensures schema compatibility
 *
 * Includes:
 * - `AppSyncUtilsPlugin`
 * - `AppSyncSchemaGeneratorPlugin`
 *
 * @returns An array of plugin factories.
 */

export function appsyncPreset(options: AppSyncPresetOptions = {}) {
  return [
    appSyncUtilsPlugin(),
    appSyncSchemaGeneratorPlugin({
      emitFile: options.emitFile,
      scalarMappings: options.scalarMappings,
    }),
  ];
}
