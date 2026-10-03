import ts from "typescript";
import { createPluginFactory, ITransformerContext } from "@gqlbase/core";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  FieldNode,
  InterfaceNode,
  isEnumNode,
  isInputObjectNode,
  isInterfaceNode,
  isNullableTypeNode,
  isObjectNode,
  isOperationNode,
  isUnionNode,
  ObjectNode,
  UnionNode,
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
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import {
  getAuthModeIdentityType,
  isComputed,
  MiddyAppSyncDirective,
  type MiddyAppSyncGraphQLPluginOptions,
} from "./MiddyAppSyncGraphQLPlugin.utils.js";

const UTILITY_TYPES = ["WithTypename", "WithRequiredTypename", "WithOptional", "Override"];

/**
 * Writes `appsync/middy-appsync.types.ts`: the types resolvers build their values with, and the `Definition` of `@middy-appsync/graphql`.
 *
 * Each public object, interface and union has an AppSync version under its own name, built from the schema types' parts:
 * - an object is its `<Type>OwnFields` and its relations (optional, typed with the AppSync versions), `@computed` fields optional, and
 *   `__typename` allowed: `WithTypename<WithOptional<ProductOwnFields, "reviewCount"> & { vendor?: Vendor }, "Product">`;
 * - an own field whose type differs here (it holds a union, an interface or a `@computed` field, at any depth) is overridden:
 *   `Override<ProductEdgeOwnFields, { node: Product }>`;
 * - a union, or an interface a field returns, requires `__typename` on each member: `WithRequiredTypename<Article, "Article"> | …`.
 *
 * Enums, inputs and `Scalars` are re-exported from the schema types, so resolvers import every type from this file.
 *
 * @example
 * ```ts
 * declare module "@middy-appsync/graphql" {
 *   interface Definition {
 *     Query: {
 *       getPost: { source: null; args: { id: Scalars["ID"]["input"] }; result: Maybe<Post> };
 *     };
 *     Post: {
 *       author: { source: PostSource; args: Record<string, never>; result: Maybe<Author> };
 *     };
 *   }
 * }
 * ```
 */
export class MiddyAppSyncGraphQLPlugin extends TypesGeneratorBase {
  readonly options: MiddyAppSyncGraphQLPluginOptions;
  protected useScalarsMap = true;
  private definitions: ts.TypeElement[] = [];
  private refs: TypeReferences = createTypeReferences();
  private reExports = new Set<string>();
  private appSyncTypes = new Map<string, ts.TypeAliasDeclaration>();
  private sourceTypes = new Map<string, ts.TypeAliasDeclaration>();
  private publicDefinitions: Set<string> | null = null;
  private changed = new Set<string>();

  constructor(context: ITransformerContext, options: MiddyAppSyncGraphQLPluginOptions = {}) {
    super("MiddyAppSyncGraphQLPlugin", context);

    this.options = {
      ...options,
      resolvers: options.resolvers ?? "declared",
    };
  }

  public init() {
    this.context.base.addNode(
      DirectiveDefinitionNode.create(MiddyAppSyncDirective.COMPUTED, undefined, [
        "FIELD_DEFINITION",
      ])
    );
  }

  /**
   * Objects, interfaces and unions are referenced by their AppSync version, declared in this file under the schema name.
   */
  protected _getObjectTypeName(name: string) {
    return name;
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

  /**
   * A schema types name this file uses. Enums, inputs and `Scalars` are re-exported as they are; the parts of objects only build the
   * AppSync versions.
   */
  private _import(name: string, reExport: boolean) {
    this.refs.imports.add(name);

    if (reExport) {
      this.reExports.add(name);
    }
  }

  /**
   * Imports an enum or an input that a field, an argument or a hidden field references.
   */
  private _importNamedType(name: string) {
    const node = this.context.document.getNode(name);

    if (
      node &&
      (isEnumNode(node) || isInputObjectNode(node)) &&
      this.publicDefinitions?.has(name)
    ) {
      this._import(name, true);
    }
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

  private _getTypeReExports() {
    return ts.factory.createExportDeclaration(
      undefined,
      true,
      ts.factory.createNamedExports(
        Array.from(this.reExports).map((typeName) =>
          ts.factory.createExportSpecifier(false, undefined, ts.factory.createIdentifier(typeName))
        )
      ),
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

  private _createTypeParameter(name: string, constraint?: ts.TypeNode) {
    return ts.factory.createTypeParameterDeclaration(undefined, name, constraint);
  }

  private _createTypenameLiteral(required: boolean) {
    return ts.factory.createTypeLiteralNode([
      ts.factory.createPropertySignature(
        undefined,
        "__typename",
        required ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createTypeReferenceNode("N")
      ),
    ]);
  }

  /**
   * `WithTypename`, `WithRequiredTypename`, `WithOptional` and `Override`, exported for resolver code.
   */
  private _createUtilityTypes() {
    const T = ts.factory.createTypeReferenceNode("T");
    const K = ts.factory.createTypeReferenceNode("K");
    const U = ts.factory.createTypeReferenceNode("U");
    const string = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    const exported = [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)];

    return [
      ts.factory.createTypeAliasDeclaration(
        exported,
        "WithTypename",
        [this._createTypeParameter("T"), this._createTypeParameter("N", string)],
        ts.factory.createIntersectionTypeNode([T, this._createTypenameLiteral(false)])
      ),
      ts.factory.createTypeAliasDeclaration(
        exported,
        "WithRequiredTypename",
        [this._createTypeParameter("T"), this._createTypeParameter("N", string)],
        ts.factory.createIntersectionTypeNode([T, this._createTypenameLiteral(true)])
      ),
      ts.factory.createTypeAliasDeclaration(
        exported,
        "WithOptional",
        [
          this._createTypeParameter("T"),
          this._createTypeParameter(
            "K",
            ts.factory.createTypeOperatorNode(ts.SyntaxKind.KeyOfKeyword, T)
          ),
        ],
        ts.factory.createIntersectionTypeNode([
          ts.factory.createTypeReferenceNode("Omit", [T, K]),
          ts.factory.createTypeReferenceNode("Partial", [
            ts.factory.createTypeReferenceNode("Pick", [T, K]),
          ]),
        ])
      ),
      ts.factory.createTypeAliasDeclaration(
        exported,
        "Override",
        [this._createTypeParameter("T"), this._createTypeParameter("U")],
        ts.factory.createIntersectionTypeNode([
          ts.factory.createTypeReferenceNode("Omit", [
            T,
            ts.factory.createTypeOperatorNode(ts.SyntaxKind.KeyOfKeyword, U),
          ]),
          U,
        ])
      ),
    ];
  }

  private _getContents() {
    const nodes: ts.Node[] = [...createFileHeaders()];

    if (this.options.authorizationModes?.length) {
      this._addAuthModeImports(nodes);
    }

    nodes.push(this._getTypeImports());

    if (this.reExports.size > 0) {
      nodes.push(this._getTypeReExports());
    }

    nodes.push(...this._createUtilityTypes());
    nodes.push(...this.refs.declarations.values());
    nodes.push(...this.appSyncTypes.values());
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

  private _getPublicTypes() {
    const types: (ObjectNode | InterfaceNode | UnionNode)[] = [];

    for (const node of this.context.document.definitions.values()) {
      if (
        this.publicDefinitions?.has(node.name) &&
        !isOperationNode(node) &&
        (isObjectNode(node) || isInterfaceNode(node) || isUnionNode(node))
      ) {
        types.push(node);
      }
    }

    return types;
  }

  /**
   * The public types whose AppSync version differs from the schema types' `<Type>Full`: unions and interfaces (they require `__typename`),
   * types with `@computed` fields (optional here), and every type that holds one of them, through any field.
   */
  private _collectChanged(types: (ObjectNode | InterfaceNode | UnionNode)[]) {
    const changed = new Set<string>();

    for (const node of types) {
      if (
        isUnionNode(node) ||
        isInterfaceNode(node) ||
        node.fields?.some((field) => isComputed(field) && isPublicSchemaField(field, node))
      ) {
        changed.add(node.name);
      }
    }

    let growing = true;

    while (growing) {
      growing = false;

      for (const node of types) {
        if (changed.has(node.name) || isUnionNode(node)) {
          continue;
        }

        const holdsChanged = (node.fields ?? []).some(
          (field) => isPublicSchemaField(field, node) && changed.has(field.type.getTypeName())
        );

        if (holdsChanged) {
          changed.add(node.name);
          growing = true;
        }
      }
    }

    return changed;
  }

  private _checkNames(types: (ObjectNode | InterfaceNode | UnionNode)[]) {
    for (const name of UTILITY_TYPES) {
      if (this.context.document.getNode(name)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `The schema declares ${name}, but the AppSync resolver types generate ${name} as a utility type. Rename the type.`
        );
      }
    }

    for (const node of types) {
      if (this.context.document.getNode(`${node.name}Source`)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `The schema declares ${node.name}Source, but the AppSync resolver types generate it as the source of ${node.name}. Rename the type.`
        );
      }
    }
  }

  private _createProperty(field: FieldNode, optional: boolean) {
    this._importNamedType(field.type.getTypeName());

    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(field.name),
      optional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
      this._createValueTypeReference(field, field.type)
    );
  }

  private _createLiteralUnion(names: string[]) {
    return ts.factory.createUnionTypeNode(
      names.map((name) => ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(name)))
    );
  }

  /**
   * `WithTypename<WithOptional<Override<TOwnFields, { … }>, "computed"> & { relation?: … }, "T">`
   */
  private _createObjectVersion(node: ObjectNode | InterfaceNode) {
    const fields = (node.fields ?? []).filter((field) => isPublicSchemaField(field, node));
    const own = fields.filter((field) => !isRelationField(field));
    const relations = fields.filter((field) => isRelationField(field));
    const overridden = own.filter((field) => this.changed.has(field.type.getTypeName()));
    const computed = own.filter((field) => isComputed(field));
    const ownFields = this._getOwnFieldsTypeName(node.name);

    this._import(ownFields, false);

    for (const field of own) {
      this._importNamedType(field.type.getTypeName());
    }

    let type: ts.TypeNode = ts.factory.createTypeReferenceNode(ownFields);

    if (overridden.length) {
      type = ts.factory.createTypeReferenceNode("Override", [
        type,
        ts.factory.createTypeLiteralNode(
          overridden.map((field) => this._createProperty(field, isSemanticNullable(field)))
        ),
      ]);
    }

    if (computed.length) {
      type = ts.factory.createTypeReferenceNode("WithOptional", [
        type,
        this._createLiteralUnion(computed.map((field) => field.name)),
      ]);
    }

    if (relations.length) {
      type = ts.factory.createIntersectionTypeNode([
        type,
        ts.factory.createTypeLiteralNode(
          relations.map((field) => this._createProperty(field, true))
        ),
      ]);
    }

    return ts.factory.createTypeReferenceNode("WithTypename", [
      type,
      ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(node.name)),
    ]);
  }

  /**
   * `WithRequiredTypename<A, "A"> | WithRequiredTypename<B, "B">`, over the members of a union or the public types implementing an
   * interface.
   */
  private _createAbstractVersion(node: UnionNode | InterfaceNode) {
    const members = isUnionNode(node)
      ? (node.types ?? []).map((type) => type.getTypeName())
      : this._getPublicTypes()
          .filter((type) => isObjectNode(type) && type.hasInterface(node.name))
          .map((type) => type.name);

    if (!members.length) {
      return isUnionNode(node)
        ? ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword)
        : this._createObjectVersion(node);
    }

    return ts.factory.createUnionTypeNode(
      members.map((member) =>
        ts.factory.createTypeReferenceNode("WithRequiredTypename", [
          ts.factory.createTypeReferenceNode(member),
          ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(member)),
        ])
      )
    );
  }

  private _createAppSyncTypes() {
    const types = this._getPublicTypes();

    this._checkNames(types);
    this.changed = this._collectChanged(types);

    for (const node of types) {
      const type =
        isUnionNode(node) || isInterfaceNode(node)
          ? this._createAbstractVersion(node)
          : this._createObjectVersion(node);

      this.appSyncTypes.set(
        node.name,
        ts.factory.createTypeAliasDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          ts.factory.createIdentifier(node.name),
          undefined,
          type
        )
      );
    }
  }

  /**
   * A hidden field's type: the AppSync version or a re-exported schema type when it is public, declared in this file otherwise.
   */
  private _createHiddenFieldType(field: FieldNode) {
    const name = field.type.getTypeName();

    if (this.publicDefinitions?.has(name)) {
      this._importNamedType(name);
    } else {
      this._referenceType(name, this.refs, this.publicDefinitions ?? new Set());
    }

    return this._createValueTypeReference(field, field.type);
  }

  /**
   * The type a resolver receives as `source`: what the parent field's resolver returned. That is the AppSync version of the parent, or
   * `<Type>Source` when the parent has hidden stored fields (`@serverOnly`, `@writeOnly`, relation keys), since a parent resolver usually
   * returns the stored row. Hidden relation fields are left out: the row holds their key, not the related object.
   */
  private _getSourceTypeName(parent: ObjectNode | InterfaceNode) {
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

  private _createFieldSource(parent: ObjectNode | InterfaceNode) {
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
      this._importNamedType(arg.type.getTypeName());

      members.push(
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier(arg.name),
          isNullableTypeNode(arg.type)
            ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
            : undefined,
          this._createInputValueTypeReference(arg, arg.type)
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
    this._importNamedType(field.type.getTypeName());

    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier("result"),
      undefined,
      this._createValueTypeReference(field, field.type)
    );
  }

  private _createFieldDefinition(parent: ObjectNode | InterfaceNode, field: FieldNode) {
    return ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(field.name),
      undefined,
      ts.factory.createTypeLiteralNode([
        this._createFieldSource(parent),
        this._createFieldArgs(field),
        this._createFieldResult(field),
      ])
    );
  }

  public before() {
    this.definitions = [];
    this.refs = createTypeReferences();
    this.reExports.clear();
    this.appSyncTypes.clear();
    this.sourceTypes.clear();
    this.changed.clear();
    this.publicDefinitions = null;
  }

  public match(node: DefinitionNode): boolean {
    return (isObjectNode(node) || isInterfaceNode(node)) && !isInternal(node);
  }

  /**
   * `@computed` is for fields AppSync resolves that have no resolver of their own yet.
   */
  public execute(node: ObjectNode | InterfaceNode) {
    for (const field of node.fields ?? []) {
      if (!isComputed(field)) {
        continue;
      }

      const reason = isOperationNode(node)
        ? "an operation field, which always has its own resolver"
        : isRelationField(field)
          ? "a relation field, which always has its own resolver"
          : !isPublicSchemaField(field, node)
            ? "not in the public schema, so AppSync never resolves it"
            : null;

      if (reason) {
        throw new TransformerPluginExecutionError(
          this.name,
          `@computed on ${node.name}.${field.name}: the field is ${reason}.`
        );
      }
    }
  }

  public generate(node: ObjectNode | InterfaceNode) {
    // Collected on the first call: execute has finished, and nothing changes the document during generate.
    if (!this.publicDefinitions) {
      this.publicDefinitions = collectPublicDefinitions(this.context);
      this._import("Maybe", false);
      this._import("Scalars", true);
      this._createAppSyncTypes();
    }

    if (!this.publicDefinitions.has(node.name)) {
      return;
    }

    const members: ts.TypeElement[] = [];

    for (const field of node.fields ?? []) {
      if (!isPublicSchemaField(field, node)) {
        continue;
      }

      if (
        this.options.resolvers === "all" ||
        isOperationNode(node) ||
        isRelationField(field) ||
        isComputed(field)
      ) {
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

  public cleanup(node: ObjectNode | InterfaceNode) {
    for (const field of node.fields ?? []) {
      field.removeDirective(MiddyAppSyncDirective.COMPUTED);
    }
  }

  public after() {
    this.context.document.removeNode(MiddyAppSyncDirective.COMPUTED);
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
