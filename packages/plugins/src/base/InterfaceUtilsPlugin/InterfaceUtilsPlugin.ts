import { createPluginFactory, ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import {
  DefinitionNode,
  FieldNode,
  InterfaceNode,
  NamedTypeNode,
  ObjectNode,
} from "@gqlbase/core/definition";
import { hasInterfaces } from "./InterfaceUtilsPlugin.utils.js";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";

/**
 * Normalizes interface implementation by other interfaces and objects, makeing sure that all fields defined in an interface are implemented by its implementors, and that interfaces can implement other interfaces:
 *
 * - When an object or interface implements another interface, it must implement all fields defined in the implemented interface.
 * - "Transitively implemented interfaces (interfaces implemented by the interface that is being implemented) must also be defined on an implementing type or interface."
 *
 * @see https://spec.graphql.org/September2025/#sec-Interfaces
 *
 * @example
 * ```graphql
 * # Before
 * interface Node {
 *   id: ID!
 * }
 *
 * interface Timestamped {
 *   createdAt: DateTime!
 *   updatedAt: DateTime!
 * }
 *
 * interface User implements Node & Timestamped {
 *   id: ID!
 *   name: String!
 * }
 *
 * # After
 * interface Node {
 *   id: ID!
 * }
 *
 * interface Timestamped {
 *   createdAt: DateTime!
 *   updatedAt: DateTime!
 * }
 *
 * interface User implements Node & Timestamped {
 *   id: ID!
 *   name: String!
 *   createdAt: DateTime! # added by the plugin
 *   updatedAt: DateTime! # added by the plugin
 * }
 * ```
 */

export class InterfaceUtilsPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("InterfaceUtilsPlugin", context);
  }

  private _getValidInterface(name: string): InterfaceNode {
    const iface = this.context.document.getNodeOrThrow(name);

    if (!(iface instanceof InterfaceNode)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Node ${name} is not an interface but is implemented by ${name}`
      );
    }

    return iface;
  }

  private _normalizeTransitiveInterfaces(node: InterfaceNode | ObjectNode) {
    for (const ifaceName of node.getInterfaces()) {
      const iface = this._getValidInterface(ifaceName.getTypeName());

      if (!hasInterfaces(iface)) {
        continue;
      }

      for (const transitiveIfaceName of iface.getInterfaces()) {
        if (!node.hasInterface(transitiveIfaceName.getTypeName())) {
          node.addInterface(transitiveIfaceName);
        }
      }
    }
  }

  private _normalizeInterfaceFields(node: InterfaceNode | ObjectNode) {
    for (const ifaceName of node.getInterfaces()) {
      const iface = this._getValidInterface(ifaceName.getTypeName());

      for (const field of iface.getFields()) {
        if (node.hasField(field.name)) {
          const nodeField = node.getField(field.name);

          if (nodeField?.type.getTypeName() !== field.type.getTypeName()) {
            this.context.logger.warn(
              `Field ${field.name} on ${node.name} has type ${nodeField?.type.getTypeName()} but should be ${field.type.getTypeName()} as defined in interface ${iface.name}`
            );

            nodeField?.setType(NamedTypeNode.create(field.type.getTypeName()));
          }

          continue;
        }

        node.addField(FieldNode.fromDefinition(field.serialize()));
      }
    }
  }

  public match(definition: DefinitionNode) {
    return definition instanceof InterfaceNode || definition instanceof ObjectNode;
  }

  public normalize(node: InterfaceNode | ObjectNode) {
    if (!hasInterfaces(node)) {
      return;
    }

    this._normalizeTransitiveInterfaces(node);
    this._normalizeInterfaceFields(node);
  }
}

export const interfaceUtilsPlugin = createPluginFactory(InterfaceUtilsPlugin);
