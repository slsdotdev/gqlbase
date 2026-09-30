import { type ITransformerContext } from "../../context/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { type ITransformerPlugin } from "../ITransformerPlugin.js";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  InputValueNode,
  InterfaceNode,
  isInterfaceNode,
  isObjectNode,
  ObjectNode,
  ValueNode,
} from "../../definition/index.js";
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
        DirectiveDefinitionNode.create(
          UtilityDirective.READ_ONLY,
          ValueNode.string(
            "Marks a field as read-only, meaning it should only be included in output types and not in input types.",
            true
          ),
          ["FIELD_DEFINITION"]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          UtilityDirective.WRITE_ONLY,
          ValueNode.string(
            "Marks a field as write-only, meaning it should only be included in input types and not in output types.",
            true
          ),
          ["FIELD_DEFINITION"]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          UtilityDirective.SERVER_ONLY,
          ValueNode.string(
            "Marks a field as server-only, meaning it should only be included in the persistence layer and not exposed in final GraphQL schema.",
            true
          ),
          ["FIELD_DEFINITION"]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          UtilityDirective.CLIENT_ONLY,
          ValueNode.string(
            `Marks a field as client-only, meaning the output value for this field is computed at runtime, and should not be included in the persistence layer.\n\nThis is useful for fields that are computed from other fields, or for fields that are only relevant to the client and should not be stored in the database.\n\nThe field will not be included in input objects.`,
            true
          ),
          ["FIELD_DEFINITION"]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          UtilityDirective.FILTER_ONLY,
          ValueNode.string(
            "The field will be preserved in the output type but only included in the filter input."
          ),
          ["FIELD_DEFINITION"]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          UtilityDirective.CREATE_ONLY,
          ValueNode.string(
            "The field will be preserved in the output type but only included in the create input."
          ),
          ["FIELD_DEFINITION"]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          UtilityDirective.UPDATE_ONLY,
          ValueNode.string(
            "The field will be preserved in the output type but only included in the update input."
          ),
          ["FIELD_DEFINITION"]
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          UtilityDirective.CONSTRAINT,
          ValueNode.string(
            "Adds validation constraints to a field. Mainly used by other plugins to add validation rules to fields. At least one parameter must be provided."
          ),
          ["FIELD_DEFINITION", "INPUT_FIELD_DEFINITION", "ARGUMENT_DEFINITION"],
          [
            InputValueNode.create("min", undefined, undefined, "Float"),
            InputValueNode.create("max", undefined, undefined, "Float"),
            InputValueNode.create("pattern", undefined, undefined, "String"),
          ]
        )
      );
  }

  public match(definition: DefinitionNode) {
    return isObjectNode(definition) || isInterfaceNode(definition);
  }

  public cleanup(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      if (field.hasDirective(UtilityDirective.READ_ONLY)) {
        field.removeDirective(UtilityDirective.READ_ONLY);
      }

      if (field.hasDirective(UtilityDirective.WRITE_ONLY)) {
        definition.removeField(field.name);
      }

      if (field.hasDirective(UtilityDirective.SERVER_ONLY)) {
        definition.removeField(field.name);
      }

      if (field.hasDirective(UtilityDirective.CLIENT_ONLY)) {
        field.removeDirective(UtilityDirective.CLIENT_ONLY);
      }

      if (field.hasDirective(UtilityDirective.FILTER_ONLY)) {
        field.removeDirective(UtilityDirective.FILTER_ONLY);
      }

      if (field.hasDirective(UtilityDirective.CREATE_ONLY)) {
        field.removeDirective(UtilityDirective.CREATE_ONLY);
      }

      if (field.hasDirective(UtilityDirective.UPDATE_ONLY)) {
        field.removeDirective(UtilityDirective.UPDATE_ONLY);
      }

      if (field.hasDirective(UtilityDirective.CONSTRAINT)) {
        field.removeDirective(UtilityDirective.CONSTRAINT);
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
      .removeNode(UtilityDirective.UPDATE_ONLY)
      .removeNode(UtilityDirective.CONSTRAINT);
  }
}

export const utilsPlugin = createPluginFactory(UtilitiesPlugin);
