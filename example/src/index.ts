import type { Handler } from "aws-lambda";
import { appSyncGraphQLRouter, type AnyAppSyncResolverLikeEvent } from "@middy-appsync/graphql";
import { resolvers } from "./resolvers";

export const handler: Handler<
  AnyAppSyncResolverLikeEvent,
  Record<string, unknown>
> = appSyncGraphQLRouter({ resolvers });
