import { Kind } from "graphql";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
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
 * The plugin that adds an *internal* node removes it in `after()`. `SchemaGeneratorPlugin` removes any that are left, since internal definitions never reach the client schema.
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
 *   bigint
 *   boolean
 *   object
 *   unknown
 * }
 *
 * # Usage: the type is an enum value, not a string literal
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
          InputValueNode.create("type", undefined, undefined, NonNullTypeNode.create("TypeHint"))
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

  /**
   * `validateSDL` does not check argument values, so a string literal (`type: "string"`) or an unknown value would silently become `unknown`. Reject both.
   */
  public normalize(definition: ScalarNode): void {
    const argument = definition.getDirective(InternalDirective.TYPE_HINT)?.getArgument("type");

    if (!argument) {
      return;
    }

    const allowed = Object.values(TypeHintValue) as string[];

    if (argument.value.kind !== Kind.ENUM || !allowed.includes(argument.value.value)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Invalid @${InternalDirective.TYPE_HINT} on scalar ${definition.name}: "type" must be one of the enum values ${allowed.join(", ")} (for example \`type: string\`, not \`type: "string"\`).`
      );
    }
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
