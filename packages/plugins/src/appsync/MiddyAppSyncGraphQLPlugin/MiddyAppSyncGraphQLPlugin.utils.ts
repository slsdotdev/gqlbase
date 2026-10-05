import { type FieldNode } from "@gqlbase/core/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";

export type AppSyncAuthorizationMode = "cognito" | "iam" | "oidc" | "apiKey" | "lambda";

export interface MiddyAppSyncGraphQLPluginOptions {
  /**
   * Allowed authorization modes for your AppSync GraphQL API.
   * It will narrow down the identity types in the generated definition.
   */
  authorizationModes?: AppSyncAuthorizationMode[];

  /**
   * Which fields get a resolver typing in `Definition`:
   * - `"declared"`: fields that have their own resolver: operation fields, relation fields and `@computed` fields;
   * - `"all"`: every public field.
   *
   * A typing only lets a resolver be written. The fields a parent's resolver may leave out are the same in both modes.
   * @default "declared"
   */
  resolvers?: "declared" | "all";
}

export enum MiddyAppSyncDirective {
  COMPUTED = "computed",
}

/**
 * A `@computed` field has its own resolver, so the parent's resolver may leave it out.
 */
export const isComputed = (field: FieldNode) => field.hasDirective(MiddyAppSyncDirective.COMPUTED);

export const getAuthModeIdentityType = (mode: AppSyncAuthorizationMode): string => {
  switch (mode) {
    case "cognito":
      return "AppSyncIdentityCognito";
    case "iam":
      return "AppSyncIdentityIAM";
    case "oidc":
      return "AppSyncIdentityOIDC";
    case "lambda":
      return "AppSyncIdentityLambda";
    case "apiKey":
      return "null"; // API Key auth doesn't have an identity object
    default:
      throw new TransformerPluginExecutionError(
        "MiddyAppSyncGraphQLPlugin",
        `Unsupported authorization mode: ${mode}`
      );
  }
};
