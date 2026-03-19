import { ITransformerContext } from "@gqlbase/core/context";
import { createPluginFactory, ITransformerPlugin } from "@gqlbase/core/plugins";
import {
  DefinitionNode,
  InputValueNode,
  InterfaceNode,
  ObjectNode,
  FieldNode,
  UnionNode,
  NonNullTypeNode,
  ListTypeNode,
  NamedTypeNode,
  DirectiveNode,
} from "@gqlbase/core/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { camelCase, pascalCase } from "@gqlbase/shared/format";
import { UtilityDirective } from "../base/index.js";
import { isRelationField } from "../base/RelationsPlugin/index.js";

export const ConnectionDirective = {
  HAS_ONE: "hasOne",
  HAS_MANY: "hasMany",
} as const;

export const RelationType = {
  ONE_TO_ONE: "oneToOne",
  ONE_TO_MANY: "oneToMany",
  MANY_TO_MANY: "manyToMany",
} as const;

type Relation = (typeof RelationType)[keyof typeof RelationType];

export const isConnectionNode = (node: DefinitionNode): boolean => {
  if (node instanceof ObjectNode) {
    if (!node.name.endsWith("Connection")) return false;
    if (!node.fields || node.fields.length < 2) return false;
    if (!node.hasField("edges") || !node.hasField("pageInfo")) return false;
    return true;
  }

  return false;
};

export const isEdgeNode = (node: DefinitionNode): boolean => {
  if (node instanceof ObjectNode) {
    if (!node.name.endsWith("Edge")) return false;
    if (!node.fields || node.fields.length < 2) return false;
    if (!node.hasField("node") || !node.hasField("cursor")) return false;
    return true;
  }

  return false;
};

export interface DirectiveArgs {
  relation?: Relation;
  key?: string;
}

export interface FieldConnection {
  relation: Relation;
  target: ObjectNode | InterfaceNode | UnionNode;
  key?: string;
}

export class ConnectionPlugin implements ITransformerPlugin {
  public readonly name = "ConnectionPlugin";
  readonly context: ITransformerContext;

  constructor(context: ITransformerContext) {
    this.context = context;
  }

  private _getConnectionTarget(field: FieldNode) {
    const fieldType = this.context.document.getNode(field.type.getTypeName());

    if (isRelationField(field)) {
      return fieldType;
    }

    return undefined;
  }

  private _getFieldConnection(
    object: ObjectNode | InterfaceNode,
    field: FieldNode
  ): FieldConnection | null {
    const target = this._getConnectionTarget(field);

    if (!target) return null;

    if (
      !(target instanceof ObjectNode) &&
      !(target instanceof InterfaceNode) &&
      !(target instanceof UnionNode)
    ) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${target.name} is not a valid connection target for ${object.name}.${field.name} `
      );
    }

    let directive = field.getDirective(ConnectionDirective.HAS_ONE);

    if (directive) {
      if (field.hasDirective(ConnectionDirective.HAS_MANY)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Multiple connection directive detected for field: ${field.name}`
        );
      }

      const args = directive.getArgumentsJSON<{ key: string }>();

      return {
        relation: RelationType.ONE_TO_ONE,
        target: target,
        key: args.key ?? camelCase(field.name, "id"),
      };
    }

    directive = field.getDirective(ConnectionDirective.HAS_MANY);

    if (directive) {
      const args = directive.getArgumentsJSON<{ key: string; relation: Relation }>();

      return {
        relation: args.relation ?? RelationType.ONE_TO_MANY,
        target: target,
        key: args.key,
      };
    }

    throw new TransformerPluginExecutionError(
      this.name,
      `Could not find connection directive: ${field.name}`
    );
  }

  private _setConnectionArguments(field: FieldNode) {
    if (!field.hasArgument("first")) {
      field.addArgument(InputValueNode.create("first", NamedTypeNode.create("Int")));
    }

    if (!field.hasArgument("after")) {
      field.addArgument(InputValueNode.create("after", NamedTypeNode.create("String")));
    }
  }

  /**
   * For one-to-many connections user should be able to add the connection key via mutations.
   * By default the connection key is _writeOnly_ meaning we only add it to the mutation inputs.
   */

  private _setConnectionKey(node: ObjectNode | InterfaceNode, key: string, isPrivate = false) {
    if (!node.hasField(key)) {
      node.addField(
        FieldNode.create(key, NamedTypeNode.create("ID"), null, [
          isPrivate
            ? DirectiveNode.create(UtilityDirective.SERVER_ONLY)
            : DirectiveNode.create(UtilityDirective.WRITE_ONLY),
        ])
      );
    }
  }

  private _createConnectionTypes(field: FieldNode, connection: FieldConnection) {
    const { target } = connection;

    if (!isConnectionNode(target)) {
      const connectionTypeName = pascalCase(target.name, "connection");
      const edgeTypeName = pascalCase(target.name, "edge");

      let connectionType = this.context.document.getNode(connectionTypeName) as ObjectNode;
      let edgeType = this.context.document.getNode(edgeTypeName) as ObjectNode;

      if (!connectionType) {
        connectionType = ObjectNode.create(connectionTypeName, [
          FieldNode.create(
            "edges",
            NonNullTypeNode.create(ListTypeNode.create(NonNullTypeNode.create(edgeTypeName)))
          ),
          FieldNode.create("pageInfo", NonNullTypeNode.create("PageInfo")),
        ]);

        this.context.document.addNode(connectionType);
      }

      if (!edgeType) {
        edgeType = ObjectNode.create(`${target.name}Edge`, [
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

  private _createEdgesConnection(
    parent: ObjectNode | InterfaceNode,
    field: FieldNode,
    connection: FieldConnection
  ) {
    this._createConnectionTypes(field, connection);
  }

  public init(): void {
    this.context.base.addNode(
      ObjectNode.create("PageInfo", [
        FieldNode.create("hasNextPage", NamedTypeNode.create("Boolean")),
        FieldNode.create("hasPreviousPage", NamedTypeNode.create("Boolean")),
        FieldNode.create("startCursor", NamedTypeNode.create("String")),
        FieldNode.create("endCursor", NamedTypeNode.create("String")),
      ])
    );
  }

  public match(definition: DefinitionNode): boolean {
    if (definition instanceof InterfaceNode || definition instanceof ObjectNode) {
      if (definition.name === "Mutation") return false;
      if (isConnectionNode(definition) || isEdgeNode(definition)) return false;
      if (!definition.fields?.length) return false;

      return true;
    }

    return false;
  }

  public normalize(definition: ObjectNode | InterfaceNode): void {
    for (const field of definition.fields ?? []) {
      const connection = this._getFieldConnection(definition, field);

      if (!connection) {
        continue;
      }

      if (connection.relation === RelationType.ONE_TO_ONE && connection.key) {
        this._setConnectionKey(definition, connection.key, true);
      }

      if (
        connection.relation === RelationType.ONE_TO_MANY &&
        !isConnectionNode(connection.target)
      ) {
        const sourceKey = connection.key ?? camelCase(definition.name, "id");

        if (connection.target instanceof UnionNode) {
          for (const type of connection.target.types ?? []) {
            const unionType = this.context.document.getNode(type.getTypeName());

            if (unionType instanceof ObjectNode || unionType instanceof InterfaceNode) {
              this._setConnectionKey(unionType, sourceKey, false);
            }
          }
        } else {
          this._setConnectionKey(connection.target, sourceKey, false);
        }
      }
    }
  }

  public execute(definition: ObjectNode | InterfaceNode) {
    if (!definition.fields) {
      throw new TransformerPluginExecutionError(
        this.name,
        "Definition does not have any fields. Make sure you run `match` before calling `execute`."
      );
    }

    for (const field of definition.fields) {
      const connection = this._getFieldConnection(definition, field);

      if (!connection) {
        continue;
      }

      if (connection.relation === RelationType.ONE_TO_MANY) {
        this._createEdgesConnection(definition, field, connection);
      }
    }
  }
}

export const connectionPlugin = createPluginFactory(ConnectionPlugin);
