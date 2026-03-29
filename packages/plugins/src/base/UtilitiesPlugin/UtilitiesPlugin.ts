import { ITransformerContext } from "@gqlbase/core/context";
import { createPluginFactory, ITransformerPlugin } from "@gqlbase/core/plugins";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  InterfaceNode,
  ObjectNode,
} from "@gqlbase/core/definition";
import { UtilityDirective } from "./UtilitiesPlugin.utils.js";

/**
 * Adds utility directives to the schema that can be used to mark fields as server-only, client-only, read-only, write-only, filter-only, create-only, or update-only.
 */

export class UtilitiesPlugin implements ITransformerPlugin {
  public readonly name = "UtilitiesPlugin";
  readonly context: ITransformerContext;

  constructor(context: ITransformerContext) {
    this.context = context;
  }

  public init(): void {
    this.context.base
      .addNode(
        DirectiveDefinitionNode.create(UtilityDirective.READ_ONLY, undefined, ["FIELD_DEFINITION"])
      )
      .addNode(
        DirectiveDefinitionNode.create(UtilityDirective.WRITE_ONLY, undefined, ["FIELD_DEFINITION"])
      )
      .addNode(
        DirectiveDefinitionNode.create(UtilityDirective.SERVER_ONLY, undefined, [
          "FIELD_DEFINITION",
        ])
      )
      .addNode(
        DirectiveDefinitionNode.create(UtilityDirective.CLIENT_ONLY, undefined, [
          "FIELD_DEFINITION",
        ])
      )
      .addNode(
        DirectiveDefinitionNode.create(UtilityDirective.FILTER_ONLY, undefined, [
          "FIELD_DEFINITION",
        ])
      )
      .addNode(
        DirectiveDefinitionNode.create(UtilityDirective.CREATE_ONLY, undefined, [
          "FIELD_DEFINITION",
        ])
      )
      .addNode(
        DirectiveDefinitionNode.create(UtilityDirective.UPDATE_ONLY, undefined, [
          "FIELD_DEFINITION",
        ])
      );
  }

  public match(definition: DefinitionNode) {
    if (definition instanceof ObjectNode || definition instanceof InterfaceNode) {
      return true;
    }

    return false;
  }

  public cleanup(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      if (field.hasDirective(UtilityDirective.READ_ONLY)) {
        field.removeDirective(UtilityDirective.READ_ONLY);
      }

      if (field.hasDirective(UtilityDirective.CLIENT_ONLY)) {
        field.removeDirective(UtilityDirective.CLIENT_ONLY);
      }

      if (field.hasDirective(UtilityDirective.FILTER_ONLY)) {
        definition.removeField(field.name);
      }

      if (field.hasDirective(UtilityDirective.CREATE_ONLY)) {
        definition.removeField(field.name);
      }

      if (field.hasDirective(UtilityDirective.UPDATE_ONLY)) {
        definition.removeField(field.name);
      }

      if (field.hasDirective(UtilityDirective.WRITE_ONLY)) {
        definition.removeField(field.name);
      }

      if (field.hasDirective(UtilityDirective.SERVER_ONLY)) {
        definition.removeField(field.name);
      }
    }
  }

  public after(): void {
    this.context.document
      .removeNode(UtilityDirective.READ_ONLY)
      .removeNode(UtilityDirective.WRITE_ONLY)
      .removeNode(UtilityDirective.SERVER_ONLY)
      .removeNode(UtilityDirective.CLIENT_ONLY)
      .removeNode(UtilityDirective.FILTER_ONLY)
      .removeNode(UtilityDirective.CREATE_ONLY)
      .removeNode(UtilityDirective.UPDATE_ONLY);
  }
}

export const utilsPlugin = createPluginFactory(UtilitiesPlugin);
