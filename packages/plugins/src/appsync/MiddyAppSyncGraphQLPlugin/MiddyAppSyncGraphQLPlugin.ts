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
import { isInternal, isRelationField, TypesGeneratorBase } from "@gqlbase/core/plugins";
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
 * // generated/middy/middy-appsync.typegen.ts
 * import { User } from "../models.typegen";
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
  private typeImports = new Set<string>();

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
    const specifiers = Array.from(this.typeImports).map((typeName) =>
      ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(typeName))
    );

    return ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        ts.SyntaxKind.TypeKeyword,
        undefined,
        ts.factory.createNamedImports(specifiers)
      ),
      ts.factory.createStringLiteral("../models.typegen"),
      undefined
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

    if (this.typeImports.size > 0) {
      nodes.push(this._getTypeImports());
    }

    nodes.push(this._createModuleDeclaration());

    const file = ts.createSourceFile(
      "middy-appsync.typegen.ts",
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

  private _createFieldSource(parent: ObjectNode) {
    if (!isOperationNode(parent)) {
      this.typeImports.add(parent.name);
    }

    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier("source"),
      undefined,
      isOperationNode(parent)
        ? ts.factory.createLiteralTypeNode(ts.factory.createNull())
        : ts.factory.createTypeReferenceNode(parent.name, undefined)
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
        this.typeImports.add(arg.type.getTypeName());
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
      this.typeImports.add(field.type.getTypeName());
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
    this.typeImports.clear();
    this.typeImports.add("Maybe");
  }

  public match(node: DefinitionNode): boolean {
    return (isObjectNode(node) || isInterfaceNode(node)) && !isInternal(node);
  }

  public generate(node: ObjectNode) {
    const members: ts.TypeElement[] = [];

    for (const field of node.fields ?? []) {
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
      path: "appsync/middy-appsync.typegen.ts",
      filename: "middy-appsync.typegen.ts",
      content,
    });
    return {};
  }
}

export const middyAppSyncGraphQLPlugin = createPluginFactory(MiddyAppSyncGraphQLPlugin);
