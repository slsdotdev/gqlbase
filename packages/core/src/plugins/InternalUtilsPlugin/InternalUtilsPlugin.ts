import { ITransformerContext } from "../../context/ITransformerContext.js";
import {
  DefinitionNode,
  DirectiveNode,
  DirectiveDefinitionNode,
  EnumNode,
  InputValueNode,
  ScalarNode,
  NonNullTypeNode,
} from "../../definition/index.js";
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
        DirectiveDefinitionNode.create(InternalDirective.INTERNAL, undefined, [
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
          undefined,
          ["SCALAR"],
          InputValueNode.create("type", undefined, undefined, NonNullTypeNode.create("String"))
        )
      )
      .addNode(
        EnumNode.create(
          "TypeHint",
          undefined,
          [DirectiveNode.create(InternalDirective.INTERNAL)],
          Object.values(TypeHintValue)
        )
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
