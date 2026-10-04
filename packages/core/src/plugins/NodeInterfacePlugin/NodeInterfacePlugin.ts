import { createPluginFactory } from "../createPluginFactory.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { isModel } from "../ModelPlugin/index.js";
import type { ITransformerContext } from "../../context/index.js";
import {
  DefinitionNode,
  DirectiveNode,
  FieldNode,
  InputValueNode,
  InterfaceNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
} from "../../definition/index.js";
import { InvalidDefinitionError, TransformerPluginExecutionError } from "@gqlbase/shared/errors";

/**
 * Adds a `Node` interface with an `id: ID!` field to the schema, or reuses a declared one (`id: GUID!`), and ensures that all types
 * that implement the `Node` interface have an `id` of the interface's type. `Query.node` takes the id as that type.
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
    const node = this.context.document.getOrCreateNode("Node", InterfaceNode.create("Node"));

    if (!(node instanceof InterfaceNode)) {
      throw new InvalidDefinitionError("Node type must be an interface");
    }

    if (!node.hasField("id")) {
      node.addField(
        FieldNode.create(
          "id",
          undefined,
          undefined,
          NonNullTypeNode.create(NamedTypeNode.create("ID"))
        )
      );
    }

    // The id's type is the interface's: `ID` by default, or what a redeclared `Node` says (`id: GUID!`).
    const idField = node.getField("id") as FieldNode;
    const idTypeName = idField.type.getTypeName();

    // Added here rather than in `execute`, so the plugins that read a model's id type while normalizing (`get` and
    // `delete` arguments, relation keys) see the one `Node` gives it.
    for (const definition of this.context.document.definitions.values()) {
      if (definition instanceof ObjectNode && this.match(definition) && !definition.hasField("id")) {
        definition.addField(FieldNode.fromDefinition(idField.serialize()));
      }
    }

    const queryNode = this.context.document.getQueryNode();

    if (!queryNode.hasField("node")) {
      queryNode.addField(
        FieldNode.create(
          "node",
          undefined,
          [DirectiveNode.create("hasOne")],
          NamedTypeNode.create("Node"),
          [
            InputValueNode.create(
              "id",
              undefined,
              undefined,
              NonNullTypeNode.create(NamedTypeNode.create(idTypeName))
            ),
          ]
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
