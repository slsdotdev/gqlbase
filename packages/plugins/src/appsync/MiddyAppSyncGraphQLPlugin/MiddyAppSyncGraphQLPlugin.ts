import ts from "typescript";
import { createPluginFactory, ITransformerContext } from "@gqlbase/core";
import {
  DefinitionNode,
  FieldNode,
  isInterfaceNode,
  isNullableTypeNode,
  isObjectNode,
  isOperationNode,
  isScalarNode,
  ObjectNode,
} from "@gqlbase/core/definition";
import {
  collectPublicDefinitions,
  isInternal,
  isPublicSchemaField,
  isRelationField,
  isSemanticNullable,
  TypesGeneratorBase,
  createTypeReferences,
  type TypeReferences,
} from "@gqlbase/core/plugins";
import { createFileHeaders } from "@gqlbase/shared/codegen";
import {
  getAuthModeIdentityType,
  type MiddyAppSyncGraphQLPluginOptions,
} from "./MiddyAppSyncGraphQLPlugin.utils.js";

/**
 * Generated definition types and templates for `@middy-appsync/graphql`.
 * @example
 * ```graphql
 * # schema.graphql
 * type User {
 *   id: ID!
 *   name: String!
 *   email: String!
 * }
 *
 * type Query {
 *   user(id: ID!): User
 * }
 * ```
 *
 * ```typescript
 * // generated/appsync/middy-appsync.types.ts
 * import { User } from "../schema.types";
 *
 * declare module "@middy-appsync/graphql" {
 *   interface Definition {
 *     User: {
 *       id: { source: User; args: Record<string, never>; result: string };
 *       name: { source: User; args: Record<string, never>; result: string };
 *       email: { source: User; args: Record<string, never>; result: string };
 *     };
 *     Query: {
 *       user: { source: null; args: { id: string }; result: User | null };
 *     };
 *   }
 * }
 * ```
 *
 *
 * ```ts
 * // resolver.ts
 * import { createResolver } from "@middy-appsync/graphql";
 *
 * const getUser = createResolver({
 *  typeName: "Query",
 *  fieldName: "user",
 *  resolve: async ({ args }) => {
 *    // Your resolver logic here
 *  }
 * })
 * ```
 */

export class MiddyAppSyncGraphQLPlugin extends TypesGeneratorBase {
  readonly options: MiddyAppSyncGraphQLPluginOptions;
  private definitions: ts.TypeElement[] = [];
  private refs: TypeReferences = createTypeReferences();
  private sourceTypes = new Map<string, ts.TypeAliasDeclaration>();
  private publicDefinitions: Set<string> | null = null;

  constructor(context: ITransformerContext, options: MiddyAppSyncGraphQLPluginOptions = {}) {
    super("MiddyAppSyncGraphQLPlugin", context);

    this.options = {
      ...options,
      relationsOnly: options.relationsOnly ?? true,
    };
  }

  private _createModuleDeclaration() {
    const statements = [
      ts.factory.createInterfaceDeclaration(
        /*modifiers*/ undefined,
        ts.factory.createIdentifier("Definition"),
        /*typeParameters*/ undefined,
        /*heritageClauses*/ undefined,
        this.definitions
      ),
    ];

    if (this.options.authorizationModes?.length) {
      const members = [];

      for (const mode of new Set(this.options.authorizationModes).values()) {
        const identityType = getAuthModeIdentityType(mode);

        if (identityType === null) {
          members.push(ts.factory.createLiteralTypeNode(ts.factory.createNull()));
          continue;
        }

        members.push(ts.factory.createTypeReferenceNode(identityType, undefined));
      }

      statements.push(
        ts.factory.createInterfaceDeclaration(
          undefined,
          ts.factory.createIdentifier("Authorization"),
          undefined,
          undefined,
          [
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier("allow"),
              undefined,
              ts.factory.createUnionTypeNode(members)
            ),
          ]
        )
      );
    }

    return ts.factory.createModuleDeclaration(
      [ts.factory.createToken(ts.SyntaxKind.DeclareKeyword)],
      ts.factory.createStringLiteral("@middy-appsync/graphql"),
      ts.factory.createModuleBlock(statements)
    );
  }

  private _getTypeImports() {
    const specifiers = Array.from(this.refs.imports).map((typeName) =>
      ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(typeName))
    );

    return ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        ts.SyntaxKind.TypeKeyword,
        undefined,
        ts.factory.createNamedImports(specifiers)
      ),
      ts.factory.createStringLiteral("../schema.types"),
      undefined
    );
  }

  /**
   * Re-exports the schema types this file uses, so resolver code imports its types from one place.
   */
  private _getTypeReExports() {
    const specifiers = Array.from(this.refs.imports)
      .filter((typeName) => typeName !== "Maybe")
      .map((typeName) =>
        ts.factory.createExportSpecifier(false, undefined, ts.factory.createIdentifier(typeName))
      );

    return ts.factory.createExportDeclaration(
      undefined,
      true,
      ts.factory.createNamedExports(specifiers),
      ts.factory.createStringLiteral("../schema.types")
    );
  }

  private _addAuthModeImports(nodes: ts.Node[]) {
    const specifiers: ts.ImportSpecifier[] = [];

    for (const mode of new Set(this.options.authorizationModes).values()) {
      const identityType = getAuthModeIdentityType(mode);

      if (identityType !== "null") {
        specifiers.push(
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier(identityType)
          )
        );
      }
    }

    if (specifiers.length) {
      nodes.push(
        ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            ts.SyntaxKind.TypeKeyword,
            undefined,
            ts.factory.createNamedImports(specifiers)
          ),
          ts.factory.createStringLiteral("aws-lambda"),
          undefined
        )
      );
    }
  }

  private _getContents() {
    const nodes: ts.Node[] = [...createFileHeaders()];

    if (this.options.authorizationModes?.length) {
      this._addAuthModeImports(nodes);
    }

    if (this.refs.imports.size > 0) {
      nodes.push(this._getTypeImports(), this._getTypeReExports());
    }

    nodes.push(...this.refs.declarations.values());
    nodes.push(...this.sourceTypes.values());

    nodes.push(this._createModuleDeclaration());

    const file = ts.createSourceFile(
      "middy-appsync.types.ts",
      /*sourceText*/ "",
      ts.ScriptTarget.Latest,
      /*setParentNodes*/ false,
      ts.ScriptKind.TS
    );

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.CarriageReturnLineFeed,
      removeComments: false,
    });

    return printer.printList(ts.ListFormat.MultiLine, ts.factory.createNodeArray(nodes), file);
  }

  /**
   * A hidden field's type: imported from the schema types when it is public there, and declared in this file otherwise.
   */
  private _createHiddenFieldType(field: FieldNode) {
    this._referenceType(field.type.getTypeName(), this.refs, this.publicDefinitions ?? new Set());
    return this._createValueTypeReference(field, field.type);
  }

  /**
   * The type a resolver receives as `source`. The schema types hold only public fields, but a parent resolver usually returns the stored row, so when a type has hidden stored fields (`@serverOnly`, `@writeOnly`, relation keys) the source is `<Type>Source`: the schema type plus those fields. Hidden relation fields are left out: the row holds their key, not the related object.
   */
  private _getSourceTypeName(parent: ObjectNode) {
    const hidden = (parent.fields ?? []).filter(
      (field) =>
        !isInternal(field) && !isRelationField(field) && !isPublicSchemaField(field, parent)
    );

    if (!hidden.length) {
      return parent.name;
    }

    const name = `${parent.name}Source`;

    if (!this.sourceTypes.has(name)) {
      const members = hidden.map((field) =>
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier(field.name),
          isSemanticNullable(field)
            ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
            : undefined,
          this._createHiddenFieldType(field)
        )
      );

      this.sourceTypes.set(
        name,
        ts.factory.createTypeAliasDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          ts.factory.createIdentifier(name),
          undefined,
          ts.factory.createIntersectionTypeNode([
            ts.factory.createTypeReferenceNode(parent.name, undefined),
            ts.factory.createTypeLiteralNode(members),
          ])
        )
      );
    }

    return name;
  }

  private _createFieldSource(parent: ObjectNode) {
    if (!isOperationNode(parent)) {
      this.refs.imports.add(parent.name);
    }

    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier("source"),
      undefined,
      isOperationNode(parent)
        ? ts.factory.createLiteralTypeNode(ts.factory.createNull())
        : ts.factory.createTypeReferenceNode(this._getSourceTypeName(parent), undefined)
    );
  }

  private _createFieldArgs(field: FieldNode) {
    if (!field.arguments || field.arguments.length === 0) {
      return ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier("args"),
        undefined,
        ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("Record"), [
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
        ])
      );
    }

    const members: ts.TypeElement[] = [];

    for (const arg of field.arguments) {
      const maybeNode = this.context.document.getNode(arg.type.getTypeName());

      if (maybeNode && !isScalarNode(maybeNode)) {
        this.refs.imports.add(arg.type.getTypeName());
      }

      const typeNode = this._createInputValueTypeReference(arg, arg.type);
      const questionToken = isNullableTypeNode(arg.type)
        ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
        : undefined;

      members.push(
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier(arg.name),
          questionToken,
          typeNode
        )
      );
    }

    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier("args"),
      undefined,
      ts.factory.createTypeLiteralNode(members)
    );
  }

  private _createFieldResult(field: FieldNode) {
    const maybeNode = this.context.document.getNode(field.type.getTypeName());

    if (maybeNode && !isScalarNode(maybeNode)) {
      this.refs.imports.add(field.type.getTypeName());
    }

    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier("result"),
      undefined,
      this._createValueTypeReference(field, field.type)
    );
  }

  private _createFieldDefinition(parent: ObjectNode, field: FieldNode) {
    const source = this._createFieldSource(parent);
    const args = this._createFieldArgs(field);
    const result = this._createFieldResult(field);

    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(field.name),
      undefined,
      ts.factory.createTypeLiteralNode([source, args, result])
    );
  }

  public before() {
    this.definitions = [];
    this.refs = createTypeReferences();
    this.refs.imports.add("Maybe");
    this.sourceTypes.clear();
    this.publicDefinitions = null;
  }

  public match(node: DefinitionNode): boolean {
    return (isObjectNode(node) || isInterfaceNode(node)) && !isInternal(node);
  }

  public generate(node: ObjectNode) {
    // Collected on the first call: execute has finished, and nothing changes the document during generate.
    this.publicDefinitions ??= collectPublicDefinitions(this.context);

    if (!this.publicDefinitions.has(node.name)) {
      return;
    }

    const members: ts.TypeElement[] = [];

    for (const field of node.fields ?? []) {
      if (!isPublicSchemaField(field, node)) {
        continue;
      }

      if (!this.options.relationsOnly) {
        members.push(this._createFieldDefinition(node, field));
        continue;
      }

      if (isOperationNode(node) || isRelationField(field)) {
        members.push(this._createFieldDefinition(node, field));
      }
    }

    this.definitions.push(
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(node.name),
        undefined,
        ts.factory.createTypeLiteralNode(members)
      )
    );
  }

  public output() {
    const content = this._getContents();

    this.context.files.push({
      type: "ts",
      path: "appsync/middy-appsync.types.ts",
      filename: "middy-appsync.types.ts",
      content,
    });
    return {};
  }
}

export const middyAppSyncGraphQLPlugin = createPluginFactory(MiddyAppSyncGraphQLPlugin);
