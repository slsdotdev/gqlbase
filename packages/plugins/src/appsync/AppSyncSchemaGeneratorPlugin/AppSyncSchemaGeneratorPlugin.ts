import { ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import {
  DefinitionNode,
  DirectiveNode,
  DocumentNode,
  EnumNode,
  FieldNode,
  InputObjectNode,
  InputValueNode,
  InterfaceNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  UnionNode,
  TypeNode,
} from "@gqlbase/core/definition";
import { createPluginFactory, isInternal } from "@gqlbase/core/plugins";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import {
  AppSyncSchemaGeneratorPluginOptions,
  isDirectiveNode,
  isScalarNode,
} from "./AppSyncSchemaGeneratorPlugin.utils.js";
import {
  isAppSyncDirective,
  isAppSyncScalar,
  mapToAppSyncScalarName,
} from "../AppSyncUtilsPlugin/AppSyncUtilsPlugin.utils.js";

/**
 * Generates an AppSync compatible GraphQL schema.
 */

export class AppSyncSchemaGeneratorPlugin extends TransformerPluginBase {
  document: DocumentNode;
  options: Required<AppSyncSchemaGeneratorPluginOptions>;

  constructor(context: ITransformerContext, options: AppSyncSchemaGeneratorPluginOptions = {}) {
    super("AppSyncSchemaGeneratorPlugin", context);

    this.options = {
      emitOutput: options.emitOutput ?? false,
      scalarMappings: options.scalarMappings ?? {},
    };

    this.document = DocumentNode.create();
  }

  private _getDirectives(
    node:
      | ObjectNode
      | InterfaceNode
      | UnionNode
      | EnumNode
      | InputObjectNode
      | FieldNode
      | InputValueNode
  ): DirectiveNode[] {
    const directives: DirectiveNode[] = [];

    for (const directive of node.directives ?? []) {
      if (isAppSyncDirective(directive.name)) {
        directives.push(DirectiveNode.fromDefinition(directive.serialize()));
      }
    }

    return directives;
  }

  private _getTypeNode<T extends TypeNode>(type: T, typeName: string): T {
    if (type instanceof NonNullTypeNode) {
      return NonNullTypeNode.create(this._getTypeNode(type.type, typeName)) as T;
    }

    if (type instanceof ListTypeNode) {
      return ListTypeNode.create(this._getTypeNode(type.type, typeName)) as T;
    }

    return NamedTypeNode.create(typeName) as T;
  }

  private _getFieldTypeNode(field: FieldNode | InputValueNode): TypeNode {
    const typeName = field.type.getTypeName();

    if (isBuildInScalar(typeName) || isAppSyncScalar(typeName)) {
      return this._getTypeNode(field.type, field.type.getTypeName());
    }
    const node = this.context.document.getNodeOrThrow(typeName);

    if (isScalarNode(node)) {
      return this._getTypeNode(
        field.type,
        mapToAppSyncScalarName(typeName, this.options.scalarMappings)
      );
    }

    return this._getTypeNode(field.type, typeName);
  }

  private _getFields(node: ObjectNode | InterfaceNode): FieldNode[] {
    const fields: FieldNode[] = [];

    for (const field of node.fields ?? []) {
      const typeNode = this._getFieldTypeNode(field);
      const directives = this._getDirectives(field);

      const args = field.arguments
        ? field.arguments.map((arg) => {
            const argTypeNode = this._getFieldTypeNode(arg);
            const argDirectives = this._getDirectives(arg);

            return InputValueNode.create(arg.name, argTypeNode, arg.defaultValue, argDirectives);
          })
        : undefined;

      fields.push(FieldNode.create(field.name, typeNode, args, directives));
    }

    return fields;
  }

  private _getInputFields(node: InputObjectNode): InputValueNode[] {
    const fields: InputValueNode[] = [];

    for (const field of node.fields ?? []) {
      const typeNode = this._getFieldTypeNode(field);
      const directives = this._getDirectives(field);

      fields.push(InputValueNode.create(field.name, typeNode, field.defaultValue, directives));
    }

    return fields;
  }

  private _addObject(node: ObjectNode) {
    const fields = this._getFields(node);
    const directives = this._getDirectives(node);
    const interfaces = node.interfaces
      ? node.interfaces.map((iface) => NamedTypeNode.create(iface.name))
      : undefined;

    this.document.addNode(ObjectNode.create(node.name, fields, interfaces, directives));
  }

  private _addInterface(node: InterfaceNode) {
    const fields = this._getFields(node);
    const directives = this._getDirectives(node);
    const interfaces = node.interfaces
      ? node.interfaces.map((iface) => NamedTypeNode.create(iface.name))
      : undefined;

    this.document.addNode(InterfaceNode.create(node.name, fields, interfaces, directives));
  }

  private _addUnion(node: UnionNode) {
    const directives = this._getDirectives(node);
    const types = node.types ? node.types.map((type) => NamedTypeNode.create(type.name)) : [];

    this.document.addNode(UnionNode.create(node.name, types, directives));
  }

  private _addEnum(node: EnumNode) {
    const directives = this._getDirectives(node);
    const values = node.values ? node.values.map((value) => value.name) : [];

    this.document.addNode(EnumNode.create(node.name, values, directives));
  }

  private _addInputObject(node: InputObjectNode) {
    const fields = this._getInputFields(node);
    const directives = this._getDirectives(node);

    this.document.addNode(InputObjectNode.create(node.name, fields, directives));
  }

  public before() {
    this.document = DocumentNode.create();
  }

  public match(definition: DefinitionNode): boolean {
    return !isScalarNode(definition) && !isDirectiveNode(definition) && !isInternal(definition);
  }

  public generate(definition: DefinitionNode) {
    if (definition instanceof InterfaceNode) {
      return this._addInterface(definition);
    }

    if (definition instanceof ObjectNode) {
      return this._addObject(definition);
    }

    if (definition instanceof UnionNode) {
      return this._addUnion(definition);
    }

    if (definition instanceof InputObjectNode) {
      return this._addInputObject(definition);
    }

    if (definition instanceof EnumNode) {
      return this._addEnum(definition);
    }
  }

  public output() {
    const schema = this.document.print();

    this.context.files.push({
      type: "graphql",
      path: "appsync/schema.graphql",
      filename: "schema.graphql",
      content: schema,
    });

    if (this.options.emitOutput) {
      return {
        appsync: { schema },
      };
    }

    return {};
  }
}

export const appSyncSchemaGeneratorPlugin = createPluginFactory(AppSyncSchemaGeneratorPlugin);
