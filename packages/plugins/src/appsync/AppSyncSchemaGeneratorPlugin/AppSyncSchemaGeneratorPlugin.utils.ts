import { DefinitionNode, DirectiveDefinitionNode, ScalarNode } from "@gqlbase/core/definition";
import { AppSyncScalarName } from "../AppSyncUtilsPlugin/AppSyncUtilsPlugin.utils.js";
import { BuildInScalar } from "@gqlbase/shared/definition";

export interface AppSyncSchemaGeneratorPluginOptions {
  /**
   * If true, the plugin will emit the generated document SDL as string in the output object.
   * @default false
   */
  emitOutput?: boolean;

  /**
   * Optional mapping of custom scalar names to AppSync scalar names or built-in scalar types.
   * This allows you to specify how custom scalars should be represented in the generated AppSync schema.
   */
  scalarMappings?: Record<string, AppSyncScalarName | BuildInScalar>;
}

export const isScalarNode = (node: DefinitionNode): boolean => {
  return node instanceof ScalarNode;
};

export const isDirectiveNode = (node: DefinitionNode): boolean => {
  return node instanceof DirectiveDefinitionNode;
};
