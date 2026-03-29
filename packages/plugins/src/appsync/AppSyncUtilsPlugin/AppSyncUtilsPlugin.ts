import { ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import {
  ArgumentNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  InputValueNode,
  ListTypeNode,
  NonNullTypeNode,
  ScalarNode,
  ValueNode,
} from "@gqlbase/core/definition";
import { createPluginFactory, InternalDirective } from "@gqlbase/core/plugins";

/**
 * This plugin adds support for AWS AppSync specific scalar and directive types.
 *
 * @definition
 * ```graphql
 * scalar AWSDate
 * scalar AWSDateTime
 * scalar AWSTime
 * scalar AWSTimestamp
 * scalar AWSEmail
 * scalar AWSJSON
 * scalar AWSURL
 * scalar AWSPhone
 * scalar AWSIPAddress
 *
 * directive `@aws_subscribe(mutations: [String!]!)` on FIELD_DEFINITION
 * directive `@aws_auth(cognito_groups: [String!])` on FIELD_DEFINITION | OBJECT
 * directive `@aws_cognito_user_pools(cognito_groups: [String!])` on FIELD_DEFINITION | OBJECT
 * directive `@aws_api_key` on FIELD_DEFINITION | OBJECT
 * directive `@aws_iam` on FIELD_DEFINITION | OBJECT
 * directive `@aws_oidc` on FIELD_DEFINITION | OBJECT
 * directive `@aws_lambda` on FIELD_DEFINITION | OBJECT
 * ```
 *
 * @see https://docs.aws.amazon.com/appsync/latest/devguide
 */

export class AppSyncUtilsPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("AppSyncUtilsPlugin", context);
  }

  public init() {
    this.context.base
      .addNode(
        ScalarNode.create("AWSDate", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("AWSDateTime", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("AWSTime", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("AWSTimestamp", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("number")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("AWSEmail", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("AWSJSON", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("object")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("AWSURL", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("AWSPhone", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("AWSIPAddress", undefined, [
          DirectiveNode.create(InternalDirective.TYPE_HINT, [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        DirectiveDefinitionNode.create(
          "aws_subscribe",
          undefined,
          ["FIELD_DEFINITION"],
          InputValueNode.create(
            "mutations",
            undefined,
            undefined,
            NonNullTypeNode.create(ListTypeNode.create(NonNullTypeNode.create("String")))
          )
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          "aws_auth",
          undefined,
          ["FIELD_DEFINITION", "OBJECT"],
          InputValueNode.create(
            "cognito_groups",
            undefined,
            undefined,
            ListTypeNode.create(NonNullTypeNode.create("String"))
          )
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          "aws_cognito_user_pools",
          undefined,
          ["FIELD_DEFINITION", "OBJECT"],
          InputValueNode.create(
            "cognito_groups",
            undefined,
            undefined,
            ListTypeNode.create(NonNullTypeNode.create("String"))
          )
        )
      )
      .addNode(
        DirectiveDefinitionNode.create("aws_api_key", undefined, ["FIELD_DEFINITION", "OBJECT"])
      )
      .addNode(DirectiveDefinitionNode.create("aws_iam", undefined, ["FIELD_DEFINITION", "OBJECT"]))
      .addNode(
        DirectiveDefinitionNode.create("aws_oidc", undefined, ["FIELD_DEFINITION", "OBJECT"])
      )
      .addNode(
        DirectiveDefinitionNode.create("aws_lambda", undefined, ["FIELD_DEFINITION", "OBJECT"])
      );
  }
}

export const appSyncUtilsPlugin = createPluginFactory(AppSyncUtilsPlugin);
