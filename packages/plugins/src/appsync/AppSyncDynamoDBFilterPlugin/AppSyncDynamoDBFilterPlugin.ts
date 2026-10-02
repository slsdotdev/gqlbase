import { createPluginFactory, ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import { DYNAMODB_FILTER_SOURCE } from "./AppSyncDynamoDBFilterPlugin.source.js";

/**
 * Emits `appsync/dynamodb-filter.ts`: `toDynamoDBFilter(filter)` renames a generated filter's operators to AppSync's, drops what
 * DynamoDB cannot filter on (nested `where`), and passes the result to `util.transform.toDynamoDBFilterExpression`. It runs in
 * APPSYNC_JS and imports `util` from `@aws-appsync/utils`.
 *
 * Registered by `appsyncPreset({ dynamoDBFilter: true })`.
 */
export class AppSyncDynamoDBFilterPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("AppSyncDynamoDBFilterPlugin", context);
  }

  public output() {
    this.context.files.push({
      type: "ts",
      path: "appsync/dynamodb-filter.ts",
      filename: "dynamodb-filter.ts",
      content: DYNAMODB_FILTER_SOURCE,
    });

    return {};
  }
}

export const appSyncDynamoDBFilterPlugin = createPluginFactory(AppSyncDynamoDBFilterPlugin);
