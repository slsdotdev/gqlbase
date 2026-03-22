import { ITransformerContext } from "@gqlbase/core/context";
import { createPluginFactory, TransformerPluginBase } from "@gqlbase/core/plugins";
import {
  DefinitionNode,
  InputValueNode,
  InterfaceNode,
  ObjectNode,
  FieldNode,
  NonNullTypeNode,
  ListTypeNode,
  NamedTypeNode,
  DirectiveNode,
  ArgumentNode,
  ValueNode,
} from "@gqlbase/core/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { pascalCase } from "@gqlbase/shared/format";
import { RfcDirective, UtilityDirective } from "../../base/index.js";
import {
  FieldRelationship,
  isPaginationConnection,
  isRelationField,
  isValidRelationTarget,
  parseFieldRelation,
} from "../../base/RelationsPlugin/index.js";
import { isRelayConnection, isRelayEdge } from "./ConnectionPlugin.utils.js";

/**
 * Transforms many relationships into Relay compaticale connections, and adds the necessary fields and arguments to support cursor based pagination.
 *
 * @example
 * ```graphql
 * # Before
 * type User {
 *   id: ID!
 *   name: String!
 *   posts: Post `@hasMany`
 * }
 *
 * type Post {
 *   id: ID!
 *   title: String!
 * }
 *
 * # After
 * type User {
 *   id: ID!
 *   name: String!
 *   posts: PostConnection
 * }
 *
 * type Post {
 *   id: ID!
 *   title: String!
 * }
 *
 * type PostConnection {
 *   edges: [PostEdge]
 *   pageInfo: PageInfo!
 * }
 *
 * type PostEdge {
 *   cursor: String
 *   node: Post
 * }
 *
 * type PageInfo {
 *   hasNextPage: Boolean!
 *   hasPreviousPage: Boolean!
 *   startCursor: String
 *   endCursor: String
 * }
 *
 * ```
 */

export class ConnectionPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("ConnectionPlugin", context);
  }

  private _getConnectionTarget(object: ObjectNode | InterfaceNode, field: FieldNode) {
    const target = this.context.document.getNode(field.type.getTypeName());

    if (!target || !isValidRelationTarget(target)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${target?.name ?? "unknwon type"} is not a valid connection target for ${object.name}.${field.name} `
      );
    }

    if (isPaginationConnection(target)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Unexpected conflicting pagination connection type ${target.name} used as a connection target for ${object.name}.${field.name}. Make sure you set "usePaginationTypes" to "false" when using relay ConnectionPlugin.`
      );
    }

    return target;
  }

  private _getFieldConnection(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): Required<FieldRelationship> | null {
    if (!isRelationField(field)) {
      return null;
    }

    const target = this._getConnectionTarget(object, field);

    return parseFieldRelation(object, field, target);
  }

  private _setConnectionArguments(field: FieldNode) {
    if (!field.hasArgument("first")) {
      field.addArgument(InputValueNode.create("first", NamedTypeNode.create("Int")));
    }

    if (!field.hasArgument("after")) {
      field.addArgument(InputValueNode.create("after", NamedTypeNode.create("String")));
    }
  }

  private _createConnection(field: FieldNode, connection: FieldRelationship) {
    const { target } = connection;

    const hasSemanticNonNull = this.context.document.hasNode(RfcDirective.SEMANTIC_NON_NULL);

    if (!isRelayConnection(target)) {
      const connectionTypeName = pascalCase(target.name, "connection");
      const edgeTypeName = pascalCase(target.name, "edge");

      let connectionType = this.context.document.getNode(connectionTypeName) as ObjectNode;
      let edgeType = this.context.document.getNode(edgeTypeName) as ObjectNode;

      if (!connectionType) {
        connectionType = ObjectNode.create(connectionTypeName, [
          FieldNode.create(
            "edges",
            ListTypeNode.create(NamedTypeNode.create(edgeTypeName)),
            null,
            hasSemanticNonNull
              ? [
                  DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL, [
                    ArgumentNode.create(
                      "levels",
                      ValueNode.list([ValueNode.int(0), ValueNode.int(1)])
                    ),
                  ]),
                ]
              : undefined
          ),
          FieldNode.create("pageInfo", NonNullTypeNode.create("PageInfo")),
        ]);

        this.context.document.addNode(connectionType);
      }

      if (!edgeType) {
        edgeType = ObjectNode.create(edgeTypeName, [
          FieldNode.create("cursor", NamedTypeNode.create("String"), null, [
            DirectiveNode.create(UtilityDirective.CLIENT_ONLY),
          ]),
          FieldNode.create("node", NamedTypeNode.create(target.name), null, [
            DirectiveNode.create(UtilityDirective.CLIENT_ONLY),
          ]),
        ]);

        this.context.document.addNode(edgeType);
      }

      this._setConnectionArguments(field);
      field.setType(NonNullTypeNode.create(connectionTypeName));
    }
  }

  public before(): void {
    if (!this.context.document.hasNode("PageInfo")) {
      this.context.document.addNode(
        ObjectNode.create("PageInfo", [
          FieldNode.create("hasNextPage", NonNullTypeNode.create("Boolean")),
          FieldNode.create("hasPreviousPage", NonNullTypeNode.create("Boolean")),
          FieldNode.create("startCursor", NamedTypeNode.create("String")),
          FieldNode.create("endCursor", NamedTypeNode.create("String")),
        ])
      );
    }
  }

  public match(definition: DefinitionNode): boolean {
    if (definition instanceof InterfaceNode || definition instanceof ObjectNode) {
      if (definition.name === "Mutation") return false;
      if (isRelayConnection(definition) || isRelayEdge(definition)) return false;
      if (!definition.fields?.length) return false;

      return true;
    }

    return false;
  }

  public execute(definition: ObjectNode | InterfaceNode) {
    for (const field of definition.fields ?? []) {
      const connection = this._getFieldConnection(definition, field);

      if (!connection) {
        continue;
      }

      if (connection.type === "oneToMany") {
        this._createConnection(field, connection);
      }
    }
  }
}

export const connectionPlugin = createPluginFactory(ConnectionPlugin);
