import { createPluginFactory, TransformerPluginBase } from "@gqlbase/core/plugins";
import type { ITransformerContext } from "@gqlbase/core/context";
import {
  DefinitionNode,
  DirectiveNode,
  FieldNode,
  InputValueNode,
  InterfaceNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
} from "@gqlbase/core/definition";
import { InvalidDefinitionError, TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { isModel } from "../../base/index.js";

/**
 * Adds a `Node` interface with an `id: ID!` field to the schema and ensures that all types that implement the `Node` interface also have the `id: ID!` field.
 *
 * @definition
 * ```graphql
 * interface Node {
 *   id: ID!
 * }
 * ```
 *
 * @example
 * ```graphql
 * # Before
 * type User `@model` {
 *   name: String!
 * }
 *
 * # After
 * interface Node {
 *   id: ID!
 * }
 *
 * type User implements Node `@model` {
 *   id: ID!
 *   name: String!
 * }
 *
 * type Query {
 *   node(id: ID!): Node @hasOne
 * }
 * ```
 */

export class NodeInterfacePlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("NodeInterfacePlugin", context);
  }

  match(definition: DefinitionNode): boolean {
    if (definition instanceof ObjectNode) {
      if (definition.hasInterface("Node") || isModel(definition)) {
        return true;
      }
    }

    return false;
  }

  before(): void {
    const node = this.context.document.getOrCreateNode("Node", InterfaceNode.create("Node", []));

    if (!(node instanceof InterfaceNode)) {
      throw new InvalidDefinitionError("Node type must be an interface");
    }

    if (!node.hasField("id")) {
      node.addField(FieldNode.create("id", NonNullTypeNode.create(NamedTypeNode.create("ID"))));
    }

    const queryNode = this.context.document.getQueryNode();

    if (!queryNode.hasField("node")) {
      queryNode.addField(
        FieldNode.create(
          "node",
          NamedTypeNode.create("Node"),
          [InputValueNode.create("id", NonNullTypeNode.create(NamedTypeNode.create("ID")))],
          [DirectiveNode.create("hasOne")]
        )
      );
    }
  }

  execute(definition: ObjectNode): void {
    const nodeInterface = this.context.document.getNodeOrThrow("Node") as InterfaceNode;

    // In definition has directive `@model` it should also implement `Node` interface
    if (isModel(definition) && !definition.hasInterface("Node")) {
      definition.addInterface(nodeInterface.name);
    }

    // Make sure that all fields declared by `Node` interface are declared by definition as well
    const nodeFields = nodeInterface.fields ?? [];

    for (const field of nodeFields) {
      if (!definition.hasField(field.name)) {
        definition.addField(FieldNode.fromDefinition(field.serialize()));
      } else {
        const nodeFieldTypeName = field.type.getTypeName();
        const fieldTypename = definition.getField(field.name)?.type.getTypeName();

        if (nodeFieldTypeName !== fieldTypename) {
          throw new TransformerPluginExecutionError(
            this.name,
            `Field ${field.name} in ${definition.name} has different type than the one declared in Node interface. Expected ${nodeFieldTypeName}, got ${fieldTypename}`
          );
        }
      }
    }
  }

  public after(): void {
    const iface = this.context.document.getNodeOrThrow("Node") as InterfaceNode;

    // Node interface should have only 1 field, the `id`
    for (const field of iface.fields ?? []) {
      if (field.name !== "id") {
        iface.removeField(field.name);
      }
    }
  }
}

export const nodeInterfacePlugin = createPluginFactory(NodeInterfacePlugin);
