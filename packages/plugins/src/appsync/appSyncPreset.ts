import { appSyncUtilsPlugin } from "./AppSyncUtilsPlugin/index.js";
import {
  appSyncSchemaGeneratorPlugin,
  AppSyncSchemaGeneratorPluginOptions,
} from "./AppSyncSchemaGeneratorPlugin/index.js";
import {
  middyAppSyncGraphQLPlugin,
  MiddyAppSyncGraphQLPluginOptions,
} from "./MiddyAppSyncGraphQLPlugin/index.js";
import { appSyncDynamoDBFilterPlugin } from "./AppSyncDynamoDBFilterPlugin/index.js";

interface MiddyAppSyncOptions extends MiddyAppSyncGraphQLPluginOptions {
  /**
   * If true, the MiddyAppSyncGraphQLPlugin will be included in the preset. If false, it will be excluded.
   *
   * @default true
   */
  enable?: boolean;
}

interface AppSyncPresetOptions {
  /**
   * If true, the AppSyncSchemaGeneratorPlugin will emit the generated document SDL as string in the output object.
   *
   * @default false
   */
  emitOutput?: boolean;
  /**
   * Optional mapping of custom scalar names to AppSync scalar names or built-in scalar types.
   * This allows you to specify how custom scalars should be represented in the generated AppSync schema.
   */
  scalarMappings?: AppSyncSchemaGeneratorPluginOptions["scalarMappings"];

  /**
   * Options for the MiddyAppSyncGraphQLPlugin
   */
  middyAppSync?: MiddyAppSyncOptions;

  /**
   * If true, emits `appsync/dynamodb-filter.ts`, which turns a filter input into a DynamoDB filter for APPSYNC_JS resolvers.
   *
   * @default false
   */
  dynamoDBFilter?: boolean;
}

/**
 * Register AWS AppSync specific features and ensures schema compatibility
 *
 * Includes:
 * - `AppSyncUtilsPlugin`
 * - `AppSyncSchemaGeneratorPlugin`
 * - `MiddyAppSyncGraphQLPlugin`, unless `middyAppSync.enable` is false
 * - `AppSyncDynamoDBFilterPlugin`, when `dynamoDBFilter` is true
 *
 * @returns An array of plugin factories.
 */

export function appsyncPreset(options: AppSyncPresetOptions = {}) {
  const {
    middyAppSync = { enable: true },
    dynamoDBFilter = false,
    ...schemaGeneratorOptions
  } = options;

  const base = [
    appSyncUtilsPlugin(),
    appSyncSchemaGeneratorPlugin({
      emitOutput: schemaGeneratorOptions.emitOutput ?? false,
      scalarMappings: schemaGeneratorOptions.scalarMappings,
    }),
  ];

  if (middyAppSync.enable !== false) {
    base.push(middyAppSyncGraphQLPlugin(middyAppSync));
  }

  if (dynamoDBFilter) {
    base.push(appSyncDynamoDBFilterPlugin());
  }

  return base;
}
