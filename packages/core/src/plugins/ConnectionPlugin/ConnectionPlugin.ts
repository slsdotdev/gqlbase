import { isBuildInScalar } from "@gqlbase/shared/definition";
import { type ITransformerContext } from "../../context/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { RfcDirective } from "../RfcFeaturesPlugin/index.js";
import { UtilityDirective } from "../UtilitiesPlugin/index.js";
import {
  type FieldRelationship,
  isRelationField,
  isValidRelationTarget,
  parseFieldRelation,
} from "../RelationsPlugin/index.js";
import { isRelayConnection, isRelayEdge } from "./ConnectionPlugin.utils.js";
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
} from "../../definition/index.js";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { pascalCase } from "@gqlbase/shared/format";

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

    const typeName = field.type.getTypeName();

    // Built-in scalars are not document nodes, but they are never a valid target.
    if (!target && isBuildInScalar(typeName)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${typeName} is not a valid connection target for ${object.name}.${field.name}`
      );
    }

    // An unknown type is reported by the validation that runs after execute.
    if (!target) {
      return null;
    }

    if (!isValidRelationTarget(target)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${target.name} is not a valid connection target for ${object.name}.${field.name}`
      );
    }

    return target;
  }

  private _getFieldConnection(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): FieldRelationship | null {
    if (!isRelationField(field)) {
      return null;
    }

    const target = this._getConnectionTarget(object, field);

    return target ? parseFieldRelation(object, field, target) : null;
  }

  private _setConnectionArguments(field: FieldNode) {
    if (!field.hasArgument("first")) {
      field.addArgument(
        InputValueNode.create("first", undefined, undefined, NamedTypeNode.create("Int"))
      );
    }

    if (!field.hasArgument("after")) {
      field.addArgument(
        InputValueNode.create("after", undefined, undefined, NamedTypeNode.create("String"))
      );
    }
  }

  private _createConnection(field: FieldNode, connection: FieldRelationship) {
    const { target } = connection;

    const { semanticNullability } = this.context.options;

    if (!isRelayConnection(target)) {
      const connectionTypeName = pascalCase(target.name, "connection");
      const edgeTypeName = pascalCase(target.name, "edge");

      let connectionType = this.context.document.getNode(connectionTypeName) as ObjectNode;
      let edgeType = this.context.document.getNode(edgeTypeName) as ObjectNode;

      if (!connectionType) {
        connectionType = ObjectNode.create(connectionTypeName, undefined, undefined, [
          semanticNullability
            ? FieldNode.create(
                "edges",
                undefined,
                [
                  DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL, [
                    ArgumentNode.create(
                      "levels",
                      ValueNode.list([ValueNode.int(0), ValueNode.int(1)])
                    ),
                  ]),
                ],
                ListTypeNode.create(NamedTypeNode.create(edgeTypeName)),
                null
              )
            : FieldNode.create(
                "edges",
                undefined,
                undefined,
                NonNullTypeNode.create(ListTypeNode.create(NonNullTypeNode.create(edgeTypeName))),
                null
              ),
          FieldNode.create("pageInfo", undefined, undefined, NonNullTypeNode.create("PageInfo")),
        ]);

        this.context.document.addNode(connectionType);
      }

      if (!edgeType) {
        edgeType = ObjectNode.create(edgeTypeName, undefined, undefined, [
          FieldNode.create(
            "cursor",
            undefined,
            [DirectiveNode.create(UtilityDirective.CLIENT_ONLY)],
            NamedTypeNode.create("String"),
            null
          ),
          semanticNullability
            ? FieldNode.create(
                "node",
                undefined,
                [
                  DirectiveNode.create(UtilityDirective.CLIENT_ONLY),
                  DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL),
                ],
                NamedTypeNode.create(target.name),
                null
              )
            : FieldNode.create(
                "node",
                undefined,
                [DirectiveNode.create(UtilityDirective.CLIENT_ONLY)],
                NonNullTypeNode.create(target.name),
                null
              ),
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
        ObjectNode.create("PageInfo", undefined, undefined, [
          FieldNode.create("hasNextPage", undefined, undefined, NonNullTypeNode.create("Boolean")),
          FieldNode.create(
            "hasPreviousPage",
            undefined,
            undefined,
            NonNullTypeNode.create("Boolean")
          ),
          FieldNode.create("startCursor", undefined, undefined, NamedTypeNode.create("String")),
          FieldNode.create("endCursor", undefined, undefined, NamedTypeNode.create("String")),
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
