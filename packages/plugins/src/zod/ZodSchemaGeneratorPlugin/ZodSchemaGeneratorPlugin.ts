import ts from "typescript";
import { createPluginFactory, ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import { pascalCase } from "@gqlbase/shared/format";
import {
  getTypeHint,
  isInternal,
  isBaseScalar,
  type BaseScalarName,
  hasConstraints,
  parseConstraints,
  isWriteOnly,
  isSemanticNullable,
  isRelationField,
  isModel,
  isPrimaryKeyField,
  collectReachableDefinitions,
  isClientOnly,
} from "@gqlbase/core/plugins";
import {
  DefinitionNode,
  EnumNode,
  FieldNode,
  InputObjectNode,
  InputValueNode,
  InterfaceNode,
  isDirectiveDefinitionNode,
  isEnumNode,
  isInputObjectNode,
  isInterfaceNode,
  isNullableTypeNode,
  isObjectNode,
  isOperationNode,
  isScalarNode,
  isUnionNode,
  ListTypeNode,
  NonNullTypeNode,
  ObjectNode,
  TypeNode,
  UnionNode,
} from "@gqlbase/core/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { stronglyConnectedComponents } from "@gqlbase/shared/utils";
import {
  CUSTOM_SCALAR_ZOD_MAP,
  mergeOptions,
  shouldIncludeInZodCreate,
  shouldIncludeInZodUpdate,
  ZodSchemaGeneratorPluginOptions,
} from "./ZodSchemaGeneratorPlugin.utils.js";

/**
 * Generates Zod schemas for the defined types in the GraphQL schema. This can be used for runtime validation of data against the schema.
 *
 * @example
 * ```graphql
 * # schema.graphql
 * enum UserRole {
 *   ADMIN
 *   USER
 * }
 *
 * type User @model {
 *   id: ID!
 *   name: String! `@constraint(min: 3, max: 50)`
 *   email: String!
 *   role: UserRole!
 * }
 * ```
 *
 * ```typescript
 * // generated/zod/schema.validators.ts
 * import { z } from "zod";
 *
 * export const UserRoleSchema = z.enum(["ADMIN", "USER"]);
 *
 * export const UserSchema = z.object({
 *   id: z.string(),
 *   name: z.string().min(3).max(50),
 *   email: z.string(),
 *   role: UserRoleSchema,
 * });
 *
 * export const CreateUserInputSchema = z.object({
 *   id: z.string().optional(),
 *   name: z.string().min(3).max(50),
 *   email: z.string(),
 *   role: UserRoleSchema,
 * });
 *
 * export const UpdateUserInputSchema = z.object({
 *   id: z.string(),
 *   name: z.string().min(3).max(50).optional(),
 *   email: z.string().optional(),
 *   role: UserRoleSchema.optional(),
 * });
 * ```
 */

interface PendingSchema {
  name: string;
  exported: boolean;
  expr: ts.Expression;
  deps: Set<string>;
}

export class ZodSchemaGeneratorPlugin extends TransformerPluginBase {
  private reachable: Set<string> | null = null;
  private nodes: ts.Node[] = [];
  private pending: PendingSchema[] = [];
  private pendingByName = new Map<string, PendingSchema>();
  private currentRef: (name: string) => ts.Expression = (name) => ts.factory.createIdentifier(name);
  private options: Required<ZodSchemaGeneratorPluginOptions>;

  constructor(context: ITransformerContext, options: ZodSchemaGeneratorPluginOptions = {}) {
    super("ZodSchemaGeneratorPlugin", context);
    this.options = mergeOptions(options);
  }

  private _getContent() {
    const file = ts.createSourceFile(
      this.options.fileName,
      /*sourceText*/ "",
      ts.ScriptTarget.Latest,
      /*setParentNodes*/ false,
      ts.ScriptKind.TS
    );

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.CarriageReturnLineFeed,
      removeComments: false,
    });

    return printer.printList(ts.ListFormat.MultiLine, ts.factory.createNodeArray(this.nodes), file);
  }

  private _zCall(name: string, args: ts.Expression[] = []): ts.Expression {
    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier("z"),
        ts.factory.createIdentifier(name)
      ),
      undefined,
      args
    );
  }

  private _chainCall(
    expr: ts.Expression,
    method: string,
    args: ts.Expression[] = []
  ): ts.Expression {
    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(expr, ts.factory.createIdentifier(method)),
      undefined,
      args
    );
  }

  private _isScalar(typeName: string): boolean {
    const node = this.context.document.getNode(typeName);
    return node !== undefined && isScalarNode(node);
  }

  private _parseZodExpression(zodCode: string): ts.Expression {
    const sourceFile = ts.createSourceFile("temp.ts", zodCode, ts.ScriptTarget.Latest, false);
    const statement = sourceFile.statements[0];
    if (ts.isExpressionStatement(statement)) {
      return statement.expression;
    }
    throw new TransformerPluginExecutionError(
      this.name,
      `Failed to parse Zod expression: ${zodCode}`
    );
  }

  private _createScalarZodExpression(typeName: string, suffix = "Schema"): ts.Expression {
    const override = this.options.scalars[typeName];

    if (override && (isBuildInScalar(typeName) || this._isScalar(typeName))) {
      return this._parseZodExpression(override);
    }

    if (isBuildInScalar(typeName)) {
      switch (typeName) {
        case "ID":
        case "String":
          return this._zCall("string");
        case "Int":
          return this._zCall("int");
        case "Float":
          return this._zCall("number");
        case "Boolean":
          return this._zCall("boolean");
      }
    }

    if (isBaseScalar(typeName)) {
      const zodCode = CUSTOM_SCALAR_ZOD_MAP[typeName as BaseScalarName];
      return this._parseZodExpression(zodCode);
    }

    const typeDef = this.context.document.getNodeOrThrow(typeName);

    if (isScalarNode(typeDef)) {
      const hint = getTypeHint(typeDef);
      switch (hint) {
        case "id":
        case "string":
          return this._zCall("string");
        case "number":
          return this._zCall("number");
        case "boolean":
          return this._zCall("boolean");
        case "object":
          return this._parseZodExpression("z.record(z.string(), z.unknown())");
        case "unknown":
        default:
          return this._zCall("unknown");
      }
    }

    return this.currentRef(`${typeName}${suffix}`);
  }

  private _applyConstraints(expr: ts.Expression, field: FieldNode | InputValueNode): ts.Expression {
    if (!hasConstraints(field)) {
      return expr;
    }

    const constraints = parseConstraints(field);

    let result = expr;

    if (constraints.min !== undefined) {
      result = this._chainCall(result, "min", [ts.factory.createNumericLiteral(constraints.min)]);
    }

    if (constraints.max !== undefined) {
      result = this._chainCall(result, "max", [ts.factory.createNumericLiteral(constraints.max)]);
    }

    if (constraints.pattern !== undefined) {
      result = this._chainCall(result, "regex", [
        ts.factory.createRegularExpressionLiteral(`/${constraints.pattern}/`),
      ]);
    }

    return result;
  }

  private _applyNullable(expr: ts.Expression, level: number): ts.Expression {
    const nullable = this._chainCall(expr, "nullable");
    return level === 0 ? this._chainCall(nullable, "optional") : nullable;
  }

  private _createOutputFieldZodExpression(
    field: FieldNode,
    fieldType: TypeNode,
    level = 0
  ): ts.Expression {
    if (fieldType instanceof NonNullTypeNode) {
      return this._createOutputFieldZodExpression(field, fieldType.type, level);
    }

    if (fieldType instanceof ListTypeNode) {
      const elementExpr = this._createOutputFieldZodExpression(field, fieldType.type, level + 1);
      let arrayExpr = this._zCall("array", [elementExpr]);

      if (isSemanticNullable(field, level)) {
        arrayExpr = this._applyNullable(arrayExpr, level);
      }

      return arrayExpr;
    }

    // Named type (leaf)
    let expr = this._createScalarZodExpression(fieldType.name);
    expr = this._applyConstraints(expr, field);

    if (isSemanticNullable(field, level)) {
      expr = this._applyNullable(expr, level);
    }

    return expr;
  }

  private _createInputFieldZodExpression(
    field: InputValueNode,
    fieldType: TypeNode,
    level = 0,
    suffix = "Schema"
  ): ts.Expression {
    if (fieldType instanceof NonNullTypeNode) {
      return this._createInputFieldZodExpression(field, fieldType.type, level, suffix);
    }

    if (fieldType instanceof ListTypeNode) {
      const elementExpr = this._createInputFieldZodExpression(
        field,
        fieldType.type,
        level + 1,
        suffix
      );

      let arrayExpr = this._zCall("array", [elementExpr]);

      if (isNullableTypeNode(field.type, level)) {
        arrayExpr = this._applyNullable(arrayExpr, level);
      }

      return arrayExpr;
    }

    let expr = this._createScalarZodExpression(fieldType.name, suffix);
    expr = this._applyConstraints(expr, field);

    if (isNullableTypeNode(field.type, level)) {
      expr = this._applyNullable(expr, level);
    }

    return expr;
  }

  /**
   * Create/update zod expression for a model field. Mirrors the output expression for
   * inner list levels but rewrites top-level nullability per `mode`:
   *  - create: id forced optional; other fields follow `isSemanticNullable`.
   *  - update: id required; non-null fields → `.optional()` only (no `.nullable()`);
   *    nullable fields → `.optional().nullable()`.
   */
  private _createModelFieldZodExpression(
    field: FieldNode,
    fieldType: TypeNode,
    mode: "create" | "update",
    level = 0
  ): ts.Expression {
    if (fieldType instanceof NonNullTypeNode) {
      return this._createModelFieldZodExpression(field, fieldType.type, mode, level);
    }

    if (fieldType instanceof ListTypeNode) {
      const elementExpr = this._createModelFieldZodExpression(
        field,
        fieldType.type,
        mode,
        level + 1
      );
      let arrayExpr = this._zCall("array", [elementExpr]);

      if (level === 0) {
        arrayExpr = this._applyModelTopLevelNullable(arrayExpr, field, mode);
      } else if (isSemanticNullable(field, level)) {
        arrayExpr = this._applyNullable(arrayExpr, level);
      }

      return arrayExpr;
    }

    let expr = this._createScalarZodExpression(fieldType.name);
    expr = this._applyConstraints(expr, field);

    if (level === 0) {
      expr = this._applyModelTopLevelNullable(expr, field, mode);
    } else if (isSemanticNullable(field, level)) {
      expr = this._applyNullable(expr, level);
    }

    return expr;
  }

  private _applyModelTopLevelNullable(
    expr: ts.Expression,
    field: FieldNode,
    mode: "create" | "update"
  ): ts.Expression {
    const isPrimaryKey = isPrimaryKeyField(field);
    const isNullable = isSemanticNullable(field, 0);

    if (mode === "create") {
      if (isPrimaryKey) {
        return this._chainCall(expr, "optional");
      }

      return isNullable ? this._applyNullable(expr, 0) : expr;
    }

    // update mode
    if (isPrimaryKey) {
      return expr;
    }

    if (isNullable) {
      return this._applyNullable(expr, 0);
    }

    return this._chainCall(expr, "optional");
  }

  private _createObjectFieldProperties(
    definition: ObjectNode | InterfaceNode
  ): ts.ObjectLiteralElementLike[] {
    const properties: ts.ObjectLiteralElementLike[] = [];

    for (const field of definition.fields ?? []) {
      if (isInternal(field) || isWriteOnly(field) || isRelationField(field)) {
        continue;
      }

      const zodExpr = this._createOutputFieldZodExpression(field, field.type);

      properties.push(
        ts.factory.createPropertyAssignment(ts.factory.createIdentifier(field.name), zodExpr)
      );
    }

    return properties;
  }

  private _isFieldReferencingModel(field: FieldNode): boolean {
    const typeDef = this.context.document.getNode(field.type.getTypeName());

    if (typeDef && isModel(typeDef)) return true;
    return false;
  }

  private _createModelInputFieldProperties(
    model: ObjectNode,
    mode: "create" | "update"
  ): ts.ObjectLiteralElementLike[] {
    const properties: ts.ObjectLiteralElementLike[] = [];
    const shouldInclude = mode === "create" ? shouldIncludeInZodCreate : shouldIncludeInZodUpdate;

    for (const field of model.fields ?? []) {
      if (isInternal(field) || this._isFieldReferencingModel(field) || !shouldInclude(field)) {
        continue;
      }

      const zodExpr = this._createModelFieldZodExpression(field, field.type, mode);

      properties.push(
        ts.factory.createPropertyAssignment(ts.factory.createIdentifier(field.name), zodExpr)
      );
    }

    return properties;
  }

  private _createInputFieldProperties(
    definition: InputObjectNode,
    excludes: string[] = [],
    suffix = "Schema"
  ): ts.ObjectLiteralElementLike[] {
    const properties: ts.ObjectLiteralElementLike[] = [];

    for (const field of definition.fields ?? []) {
      if (excludes.includes(field.name)) {
        continue;
      }

      const zodExpr = this._createInputFieldZodExpression(field, field.type, 0, suffix);

      properties.push(
        ts.factory.createPropertyAssignment(ts.factory.createIdentifier(field.name), zodExpr)
      );
    }

    return properties;
  }

  /**
   * Builds the schema's ts.Expression eagerly during `generate()` so that the
   * GraphQL definition state (relation directives, constraints, semantic-nullability)
   * is captured before the `cleanup` phase mutates the document. Deps are recorded
   * via a transient `currentRef` that pushes every referenced schema name into a
   * local set.
   */
  private _registerSchema(fullName: string, build: () => ts.Expression, exported = true): void {
    if (this.pendingByName.has(fullName)) return;

    const deps = new Set<string>();
    const prevRef = this.currentRef;

    this.currentRef = (name) => {
      deps.add(name);
      return ts.factory.createIdentifier(name);
    };

    const expr = build();

    this.currentRef = prevRef;

    const entry: PendingSchema = { name: fullName, exported, expr, deps };
    this.pending.push(entry);
    this.pendingByName.set(fullName, entry);
  }

  /**
   * Wraps every Identifier whose name is in `members` with `z.lazy(() => Identifier)`.
   * Used to break true cycles after Tarjan SCC detection. Property keys are
   * created via `ts.factory.createPropertyAssignment(Identifier(fieldName), …)` —
   * field names are camelCase and never end in `Schema`/`Base`, so they cannot
   * collide with member names; only value references get wrapped.
   */
  private _wrapCyclicRefs(expr: ts.Expression, members: Set<string>): ts.Expression {
    const result = ts.transform(expr, [
      (context) => {
        const visit: ts.Visitor = (node) => {
          if (ts.isIdentifier(node) && members.has(node.text)) {
            return this._lazyRef(node.text);
          }
          return ts.visitEachChild(node, visit, context);
        };
        return (root) => ts.visitNode(root, visit) as ts.Expression;
      },
    ]);
    return result.transformed[0] as ts.Expression;
  }

  private _toVariableStatement(
    fullName: string,
    initializer: ts.Expression,
    exported: boolean
  ): ts.VariableStatement {
    return ts.factory.createVariableStatement(
      exported ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)] : undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier(fullName),
            undefined,
            undefined,
            initializer
          ),
        ],
        ts.NodeFlags.Const
      )
    );
  }

  private _lazyRef(name: string): ts.Expression {
    return this._zCall("lazy", [
      ts.factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        ts.factory.createIdentifier(name)
      ),
    ]);
  }

  private _getSelfReferenceFields(definition: InputObjectNode): InputValueNode[] {
    const selfRefs: InputValueNode[] = [];

    for (const field of definition.fields ?? []) {
      if (field.type.getTypeName() === definition.name) {
        selfRefs.push(field);
      }
    }

    return selfRefs;
  }

  private _generateEnum(definition: EnumNode) {
    if (!definition.values?.length) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Enum type ${definition.name} must have at least one value.`
      );
    }

    this._registerSchema(`${definition.name}Schema`, () => {
      const args = (definition.values ?? []).map((v) => ts.factory.createStringLiteral(v.name));
      return this._zCall("enum", [ts.factory.createArrayLiteralExpression(args)]);
    });
  }

  private _generateObject(definition: ObjectNode | InterfaceNode) {
    this._registerSchema(`${definition.name}Schema`, () => {
      const properties = this._createObjectFieldProperties(definition);
      return this._zCall("object", [ts.factory.createObjectLiteralExpression(properties, true)]);
    });

    // Create/update schemas describe the stored row; a client-only model is never stored.
    if (isObjectNode(definition) && isModel(definition) && !isClientOnly(definition)) {
      this._generateModelMutationSchemas(definition);
    }
  }

  private _generateModelMutationSchemas(model: ObjectNode) {
    for (const mode of ["create", "update"] as const) {
      this._registerSchema(pascalCase(mode, model.name, "input", "schema"), () => {
        const properties = this._createModelInputFieldProperties(model, mode);
        return this._zCall("object", [ts.factory.createObjectLiteralExpression(properties, true)]);
      });
    }
  }

  private _generateInputObject(definition: InputObjectNode) {
    const selfRefs = this._getSelfReferenceFields(definition);

    if (selfRefs.length > 0) {
      this._registerSchema(
        `${definition.name}Base`,
        () => {
          const properties = this._createInputFieldProperties(
            definition,
            selfRefs.map((f) => f.name)
          );
          return this._zCall("object", [
            ts.factory.createObjectLiteralExpression(properties, true),
          ]);
        },
        false
      );

      this._registerSchema(`${definition.name}Schema`, () => {
        const extension = InputObjectNode.create(definition.name, undefined, undefined, selfRefs);
        return ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            this.currentRef(`${definition.name}Base`),
            ts.factory.createIdentifier("extend")
          ),
          undefined,
          [
            ts.factory.createObjectLiteralExpression(
              this._createInputFieldProperties(extension, undefined, "Base"),
              true
            ),
          ]
        );
      });

      return;
    }

    this._registerSchema(`${definition.name}Schema`, () => {
      const properties = this._createInputFieldProperties(definition);
      return this._zCall("object", [ts.factory.createObjectLiteralExpression(properties, true)]);
    });
  }

  private _generateUnion(definition: UnionNode) {
    if (!definition.types?.length) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Union type ${definition.name} must have at least one member type.`
      );
    }

    this._registerSchema(`${definition.name}Schema`, () => {
      const memberRefs = (definition.types ?? []).map((type) =>
        this.currentRef(`${type.name}Schema`)
      );
      return this._zCall("union", [ts.factory.createArrayLiteralExpression(memberRefs)]);
    });
  }

  /**
   * Walks every argument type used by this object's fields and registers
   * `PendingSchema` entries for the argument inputs and their transitive
   * input-object dependencies. Runs during `generate()` so schemas are captured
   * before `cleanup` mutates the document. Existing registrations (model-derived
   * create/update, plain object schemas, etc.) are not overwritten.
   */
  private _registerArgumentInputs(definition: ObjectNode | InterfaceNode): void {
    const visited = new Set<string>();

    for (const field of definition.fields ?? []) {
      for (const arg of field.arguments ?? []) {
        this._emitArgumentInput(arg.type.getTypeName(), visited);
      }
    }
  }

  /**
   * Depth-first walker that registers `PendingSchema` entries for an argument input
   * type and its transitive input-object dependencies. Ordering is handled later by
   * topological sort in `after()`; this method only needs to (a) avoid infinite
   * recursion via `visited`, and (b) skip non-input definitions (enums/objects/unions
   * are registered via the default `generate()` path).
   */
  private _emitArgumentInput(typeName: string, visited: Set<string>): void {
    if (visited.has(typeName)) return;
    if (isBuildInScalar(typeName)) return;

    const node = this.context.document.getNode(typeName);
    if (!node || !isInputObjectNode(node)) return;

    visited.add(typeName);

    for (const field of node.fields ?? []) {
      const depName = field.type.getTypeName();
      if (depName !== typeName) {
        this._emitArgumentInput(depName, visited);
      }
    }

    this._generateInputObject(node);
  }

  public before() {
    this.reachable = null;
    this.nodes = [];
    this.pending = [];
    this.pendingByName = new Map();
    this.currentRef = (name) => ts.factory.createIdentifier(name);

    // import * as z from "zod/v4";
    this.nodes.push(
      ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(
          undefined,
          undefined,
          ts.factory.createNamespaceImport(ts.factory.createIdentifier("z"))
        ),
        ts.factory.createStringLiteral("zod/v4"),
        undefined
      ),
      ts.factory.createIdentifier("\n")
    );
  }

  public match(definition: DefinitionNode): boolean {
    return (
      !isInternal(definition) &&
      !isScalarNode(definition) &&
      !isDirectiveDefinitionNode(definition) &&
      !isInputObjectNode(definition)
    );
  }

  public generate(definition: DefinitionNode) {
    // Stored rows and inputs: every non-internal field counts, including @serverOnly and @writeOnly ones.
    // Collected on the first call: execute has finished, and nothing changes the document during generate.
    this.reachable ??= collectReachableDefinitions(this.context, (field) => !isInternal(field));

    if (!isOperationNode(definition) && !this.reachable.has(definition.name)) {
      return;
    }

    if (isOperationNode(definition)) {
      if (this.options.generateArgumentSchemas) {
        this._registerArgumentInputs(definition as ObjectNode);
      }

      return;
    }

    if (isEnumNode(definition)) {
      return this._generateEnum(definition);
    }

    if (isObjectNode(definition) || isInterfaceNode(definition)) {
      if (this.options.generateArgumentSchemas) {
        this._registerArgumentInputs(definition);
      }

      return this._generateObject(definition);
    }

    if (isUnionNode(definition)) {
      return this._generateUnion(definition);
    }
  }

  /**
   * All schema expressions are already built and deps collected (eagerly during
   * `generate()`). Here we only need to compute SCCs and emit each `const` in
   * dependency order, wrapping intra-SCC references with `z.lazy(…)` when an
   * actual cycle exists.
   */
  public after(): void {
    // SCCs come back in reverse topological order — sinks first — which is
    // exactly the order we want for `const` emission.
    const sccs = stronglyConnectedComponents(
      this.pendingByName.keys(),
      (name) => this.pendingByName.get(name)?.deps ?? []
    );

    for (const scc of sccs) {
      const members = new Set(scc);
      const firstEntry = this.pendingByName.get(scc[0]);
      const hasSelfLoop = scc.length === 1 && !!firstEntry && firstEntry.deps.has(scc[0]);
      const isCycle = scc.length > 1 || hasSelfLoop;

      for (const name of scc) {
        const entry = this.pendingByName.get(name);
        if (!entry) continue;

        const initializer = isCycle ? this._wrapCyclicRefs(entry.expr, members) : entry.expr;
        this.nodes.push(this._toVariableStatement(name, initializer, entry.exported));
      }
    }
  }

  public output() {
    const content = this._getContent();

    this.context.files.push({
      type: "ts",
      path: `zod/${this.options.fileName}`,
      filename: this.options.fileName,
      content,
    });

    return this.options.emitOutput ? { zodSchemas: content } : {};
  }
}

export const zodSchemaGeneratorPlugin = createPluginFactory(ZodSchemaGeneratorPlugin);
