import { BuildInScalar, isBuildInScalar } from "@gqlbase/shared/definition";
import { InvalidDefinitionError } from "@gqlbase/shared/errors";
import { BaseScalarName, isBaseScalar, type TypeHintValueType } from "@gqlbase/core/plugins";

export const AppSyncScalar = {
  AWS_DATE: "AWSDate",
  AWS_DATE_TIME: "AWSDateTime",
  AWS_TIME: "AWSTime",
  AWS_TIMESTAMP: "AWSTimestamp",
  AWS_EMAIL: "AWSEmail",
  AWS_JSON: "AWSJSON",
  AWS_URL: "AWSURL",
  AWS_PHONE: "AWSPhone",
  AWS_IP_ADDRESS: "AWSIPAddress",
  LONG: "Long",
} as const;

export type AppSyncScalarName = (typeof AppSyncScalar)[keyof typeof AppSyncScalar];

export const AppSyncDirective = {
  AWS_SUBSCRIBE: "aws_subscribe",
  AWS_AUTH: "aws_auth",
  AWS_COGNITO_USER_POOLS: "aws_cognito_user_pools",
  AWS_API_KEY: "aws_api_key",
  AWS_IAM: "aws_iam",
  AWS_OIDC: "aws_oidc",
  AWS_LAMBDA: "aws_lambda",
} as const;

export type AppSyncDirectiveName = (typeof AppSyncDirective)[keyof typeof AppSyncDirective];

export const isAppSyncScalar = (typeName: string): typeName is AppSyncScalarName => {
  return Object.values(AppSyncScalar).includes(typeName as AppSyncScalarName);
};

export const isAppSyncDirective = (
  directiveName: string
): directiveName is AppSyncDirectiveName => {
  return Object.values(AppSyncDirective).includes(directiveName as AppSyncDirectiveName);
};

export const BaseScalarMappings: Record<BaseScalarName, AppSyncScalarName | BuildInScalar> = {
  Date: AppSyncScalar.AWS_DATE,
  DateTime: AppSyncScalar.AWS_DATE_TIME,
  Time: AppSyncScalar.AWS_TIME,
  Timestamp: AppSyncScalar.AWS_TIMESTAMP,
  BigInt: AppSyncScalar.LONG,
  UUID: BuildInScalar.ID,
  URL: AppSyncScalar.AWS_URL,
  EmailAddress: AppSyncScalar.AWS_EMAIL,
  PhoneNumber: AppSyncScalar.AWS_PHONE,
  IPAddress: AppSyncScalar.AWS_IP_ADDRESS,
  JSON: AppSyncScalar.AWS_JSON,
} as const;

/**
 * AppSync scalar for a custom scalar's type hint. `unknown` has none: such a scalar must be mapped explicitly.
 */
export const TypeHintMappings: Record<
  Exclude<TypeHintValueType, "unknown">,
  AppSyncScalarName | BuildInScalar
> = {
  id: BuildInScalar.ID,
  string: BuildInScalar.STRING,
  number: BuildInScalar.FLOAT,
  bigint: AppSyncScalar.LONG,
  boolean: BuildInScalar.BOOLEAN,
  object: AppSyncScalar.AWS_JSON,
} as const;

/**
 * Maps a scalar to its AppSync name: `scalarMappings` first, then GraphQL built-ins, gqlbase built-ins, and finally the scalar's type hint.
 *
 * @throws When the scalar has no mapping and its type hint is `unknown`.
 */
export const mapToAppSyncScalarName = (
  name: string,
  customConfig: Record<string, AppSyncScalarName | BuildInScalar> = {},
  typeHint: TypeHintValueType = "unknown"
): AppSyncScalarName | BuildInScalar => {
  if (customConfig[name]) {
    return customConfig[name];
  }

  if (isBuildInScalar(name)) {
    return name;
  }

  if (isBaseScalar(name)) {
    return BaseScalarMappings[name];
  }

  if (typeHint !== "unknown") {
    return TypeHintMappings[typeHint];
  }

  throw new InvalidDefinitionError(
    `Scalar ${name} has no AppSync mapping: its type hint is unknown. Add @gqlbase_typehint to the scalar, or map it with appsyncPreset({ scalarMappings: { ${name}: "<AppSync scalar>" } }).`
  );
};
