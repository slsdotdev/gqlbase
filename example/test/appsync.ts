import { readFileSync } from "node:fs";
import type { AppSyncIdentity, Context } from "aws-lambda";
import {
  type ExecutionResult,
  type FragmentDefinitionNode,
  type GraphQLFieldResolver,
  type SelectionSetNode,
  buildSchema,
  defaultFieldResolver,
  graphql,
  GraphQLError,
  Kind,
  print,
} from "graphql";
import type { AnyResolver } from "@middy-appsync/graphql";
import { handler } from "../src/index";
import { resolvers } from "../src/resolvers";

/**
 * A local stand-in for AppSync. graphql-js builds the generated AppSync schema, validates each
 * operation and walks the selection; every field that has a resolver in the example is sent to
 * the example's middy router as an AppSync Lambda event, the way AppSync invokes a Lambda data
 * source. Fields without a resolver read the property off their parent, as in AppSync.
 */

/** AppSync declares these implicitly, so the generated schema does not. */
const APPSYNC_PRELUDE = /* GraphQL */ `
  scalar AWSDate
  scalar AWSTime
  scalar AWSDateTime
  scalar AWSTimestamp
  scalar AWSEmail
  scalar AWSJSON
  scalar AWSURL
  scalar AWSPhone
  scalar AWSIPAddress
  scalar Long

  directive @aws_api_key on OBJECT | FIELD_DEFINITION
  directive @aws_iam on OBJECT | FIELD_DEFINITION
  directive @aws_oidc on OBJECT | FIELD_DEFINITION
  directive @aws_lambda on OBJECT | FIELD_DEFINITION
  directive @aws_cognito_user_pools(cognito_groups: [String]) on OBJECT | FIELD_DEFINITION
  directive @aws_auth(cognito_groups: [String]) on FIELD_DEFINITION
  directive @aws_subscribe(mutations: [String]) on FIELD_DEFINITION
`;

const sdl = readFileSync(new URL("../generated/appsync/schema.graphql", import.meta.url), "utf8");

export const schema = buildSchema(APPSYNC_PRELUDE + sdl);

const attached = new Set(
  (resolvers as AnyResolver[]).map((resolver) => `${resolver.typeName}.${resolver.fieldName}`)
);

export const cognitoIdentity = (
  sub: string,
  groups: string[] = [],
  claims: Record<string, string> = {}
): AppSyncIdentity => ({
  sub,
  issuer: "https://cognito-idp.local/example",
  username: sub,
  claims: { ...claims, sub, "cognito:groups": groups },
  sourceIp: ["127.0.0.1"],
  defaultAuthStrategy: "ALLOW",
  groups,
});

const selectionSetList = (
  selectionSet: SelectionSetNode | undefined,
  fragments: Record<string, FragmentDefinitionNode>,
  prefix = ""
): string[] => {
  const paths: string[] = [];

  for (const selection of selectionSet?.selections ?? []) {
    if (selection.kind === Kind.FIELD) {
      const path = prefix + selection.name.value;
      paths.push(path, ...selectionSetList(selection.selectionSet, fragments, `${path}/`));
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      paths.push(...selectionSetList(selection.selectionSet, fragments, prefix));
    } else {
      const fragment = fragments[selection.name.value];
      paths.push(...selectionSetList(fragment?.selectionSet, fragments, prefix));
    }
  }

  return paths;
};

interface ExecutionContext {
  identity: AppSyncIdentity | null;
}

const fieldResolver: GraphQLFieldResolver<unknown, ExecutionContext> = async (
  source,
  args,
  context,
  info
) => {
  if (!attached.has(`${info.parentType.name}.${info.fieldName}`)) {
    return defaultFieldResolver(source, args, context, info);
  }

  const selectionSet = info.fieldNodes[0]?.selectionSet;

  const event = {
    arguments: args,
    source: source ?? null,
    identity: context.identity,
    prev: null,
    request: { headers: {}, domainName: null },
    info: {
      parentTypeName: info.parentType.name,
      fieldName: info.fieldName,
      selectionSetList: selectionSetList(selectionSet, info.fragments),
      selectionSetGraphQL: selectionSet ? print(selectionSet) : "",
      variables: info.variableValues,
    },
    stash: {},
  };

  const response = await handler(event, {} as Context, () => undefined);
  const { data, error } = (response ?? {}) as {
    data?: unknown;
    error?: { type: string; message: string };
  };

  if (error) {
    throw new GraphQLError(error.message, { extensions: { errorType: error.type } });
  }

  return data;
};

export interface ExecuteOptions {
  variables?: Record<string, unknown>;
  identity?: AppSyncIdentity | null;
}

export const execute = async <TData = Record<string, unknown>>(
  source: string,
  options: ExecuteOptions = {}
) => {
  return (await graphql({
    schema,
    source,
    variableValues: options.variables,
    contextValue: { identity: options.identity ?? null },
    fieldResolver,
  })) as ExecutionResult<TData>;
};
