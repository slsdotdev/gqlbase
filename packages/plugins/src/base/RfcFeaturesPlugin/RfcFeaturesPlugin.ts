import { createPluginFactory, ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import {
  DirectiveDefinitionNode,
  InputValueNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ValueNode,
} from "@gqlbase/core/definition";

/**
 * Adds support for features that are in RFC status or draft mode.
 *
 * @see https://github.com/graphql/graphql-wg
 *
 * @definition
 * ```graphql
 * directive `@semanticNonNull(levels: [Int!]! = [0])` on FIELD_DEFINITION
 * ```
 *
 * @example
 * ```graphql
 * type User {
 *   id: ID!
 *   name: String `@semanticNonNull`
 *   tags: [String] `@semanticNonNull(levels: [0, 1])`
 * }
 * ```
 *
 * In the above example, the `name` field is decorated with the `@semanticNonNull` directive, indicating that it is semantically non-nullable. The plugin will use this information to enforce non-nullability at runtime, even if the field is not marked as non-nullable in the schema.
 */

export class RfcFeaturesPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("RfcFeaturesPlugin", context);
  }

  public init() {
    this.context.base.addNode(
      DirectiveDefinitionNode.create(
        "semanticNonNull",
        undefined,
        ["FIELD_DEFINITION"],
        InputValueNode.create(
          "levels",
          undefined,
          undefined,
          NonNullTypeNode.create(
            ListTypeNode.create(NonNullTypeNode.create(NamedTypeNode.create("Int")))
          ),
          ValueNode.list([ValueNode.int(0)])
        )
      )
    );
  }
}

export const rfcFeaturesPlugin = createPluginFactory(RfcFeaturesPlugin);
