import { ITransformerContext } from "../context/ITransformerContext.js";
import { DirectiveDefinitionNode } from "../definition/DirectiveDefinitionNode.js";
import { DefinitionNode } from "../definition/DocumentNode.js";
import { WithDirectivesNode } from "../definition/WithDirectivesNode.js";
import { createPluginFactory } from "./createPluginFactory.js";
import { ITransformerPlugin } from "./ITransformerPlugin.js";

export const InternalDirective = Object.freeze({
  INTERNAL: "gqlbase_internal",
});

/**
 * Adds an internal directive to the base document that can be used by plugins to mark nodes as internal.
 *
 * This plugin is intended for use by other plugins and should not be used directly in user code.
 *
 * The plugins are responsible for cleaning up any *internal* marked nodes after the transformation process is complete.
 *
 * @example
 * ```graphql
 * type ConfigType \@gqlbase_internal {
 *   id: ID!
 *   name: String!
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
    this.context.base.addNode(
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
    );
  }

  public match() {
    return false;
  }

  public after() {
    this.context.base.removeNode(InternalDirective.INTERNAL);
  }
}

export const internalPlugin = createPluginFactory(InternalUtilsPlugin);

/**
 * Utility function to check if a node is marked as internal (_@gqlbase_internal_).
 * @param node - The node to check.
 * @returns True if the node is marked as internal, false otherwise.
 */

export const isInternal = (node: DefinitionNode): boolean => {
  if (node instanceof WithDirectivesNode) {
    return node.hasDirective(InternalDirective.INTERNAL);
  }

  return false;
};
