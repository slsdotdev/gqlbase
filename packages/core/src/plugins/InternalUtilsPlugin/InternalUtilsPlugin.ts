import { ITransformerContext } from "../../context/ITransformerContext.js";
import { DirectiveDefinitionNode } from "../../definition/DirectiveDefinitionNode.js";
import { DirectiveNode } from "../../definition/DirectiveNode.js";
import { DefinitionNode } from "../../definition/DocumentNode.js";
import { EnumNode } from "../../definition/EnumNode.js";
import { InputValueNode } from "../../definition/InputValueNode.js";
import { ScalarNode } from "../../definition/ScalarNode.js";
import { NonNullTypeNode } from "../../definition/TypeNode.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { ITransformerPlugin } from "../ITransformerPlugin.js";
import { InternalDirective, TypeHintValue } from "./InternalUtilsPlugin.utils.js";

/**
 * Adds an internal directive to the base document that can be used by plugins to mark nodes as internal.
 *
 * This plugin is intended for use by other plugins and should not be used directly in user code.
 *
 * The plugins are responsible for cleaning up any *internal* marked nodes after the transformation process is complete.
 *
 * @example
 * ```graphql
 *
 * # Definition
 *
 * directive `@gqlbase_internal` on ARGUMENT_DEFINITION | ENUM | ENUM_VALUE | FIELD_DEFINITION | INPUT_FIELD_DEFINITION | INTERFACE | OBJECT | SCALAR | UNION
 *
 * directive `@gqlbase_typehint(type: TypeHint!)` on SCALAR
 *
 * enum TypeHint `@gqlbase_internal` {
 *   id
 *   string
 *   number
 *   boolean
 *   unknown
 * }
 *
 * # Usage
 * scalar DateTime `@gqlbase_typehint(type: string)`
 *
 * type ConfigType `@gqlbase_internal` {
 *   id: ID!
 *   name: String!
 *   createdAt: DateTime!
 *   updatedAt: DateTime!
 * }
 * ```
 */

export class InternalUtilsPlugin implements ITransformerPlugin {
  readonly name = "InternalUtilsPlugin";
  readonly context: ITransformerContext;

  constructor(context: ITransformerContext) {
    this.context = context;
  }

  public init() {
    this.context.base
      .addNode(
        DirectiveDefinitionNode.create(InternalDirective.INTERNAL, [
          "ARGUMENT_DEFINITION",
          "ENUM",
          "ENUM_VALUE",
          "FIELD_DEFINITION",
          "INPUT_FIELD_DEFINITION",
          "INTERFACE",
          "OBJECT",
          "SCALAR",
          "UNION",
        ])
      )
      .addNode(
        DirectiveDefinitionNode.create(
          InternalDirective.TYPE_HINT,
          ["SCALAR"],
          InputValueNode.create("type", NonNullTypeNode.create("String"))
        )
      )
      .addNode(
        EnumNode.create("TypeHint", Object.values(TypeHintValue), [
          DirectiveNode.create(InternalDirective.INTERNAL),
        ])
      );
  }

  public match(node: DefinitionNode): boolean {
    return node instanceof ScalarNode;
  }

  public cleanup(definition: ScalarNode): void {
    if (definition.hasDirective(InternalDirective.TYPE_HINT)) {
      definition.removeDirective(InternalDirective.TYPE_HINT);
    }
  }

  public after() {
    this.context.document
      .removeNode(InternalDirective.INTERNAL)
      .removeNode(InternalDirective.TYPE_HINT)
      .removeNode("TypeHint");
  }
}

export const internalPlugin = createPluginFactory(InternalUtilsPlugin);
