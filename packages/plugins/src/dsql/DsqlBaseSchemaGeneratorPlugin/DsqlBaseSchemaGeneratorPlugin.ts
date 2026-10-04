import ts from "typescript";
import { ITransformerContext } from "@gqlbase/core";
import {
  DefinitionNode,
  EnumNode,
  FieldNode,
  isDirectiveDefinitionNode,
  isEnumNode,
  isListTypeNode,
  isObjectLike,
  isObjectNode,
  isOperationNode,
  isScalarNode,
  isUnionNode,
  ObjectNode,
} from "@gqlbase/core/definition";
import {
  BaseScalar,
  createPluginFactory,
  getTypeHint,
  isInternal,
  isClientOnly,
  isModel,
  isRelationField,
  isSemanticNullable,
  isPrimaryKeyField,
  parseFieldRelation,
  isBelongsToRelationship,
  isManyRelationship,
  isOneRelationship,
  isRelayConnection,
  isRelayEdge,
  TypesGeneratorBase,
  collectPublicDefinitions,
  createTypeReferences,
  type TypeReferences,
} from "@gqlbase/core/plugins";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { camelCase, pluralize, snakeCase } from "@gqlbase/shared/format";
import {
  jsonToObjectAst,
  JsonValue,
  namedImportStatement,
  printNodeList,
} from "@gqlbase/shared/codegen";
import {
  DsqlBaseSchemaGeneratorPluginOptions,
  createLocalColumnBuilder,
  createLocalColumnBuilderImport,
  isLocalColumnBuilder,
  type LocalColumnBuilderName,
  mergeOptions,
  resolveScalarDataType,
  resolveTypeHintDataType,
  ScalarConfig,
} from "./DsqlBaseSchemaGeneratorPlugin.utils.js";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import {
  getIndexes,
  getUniqueConstraints,
  isUnique,
  type DsqlIndexColumn,
  isDsqlBaseTable,
} from "../DsqlBaseUtilsPlugin/index.js";

/**
 * Generates dsqlbase schema definitions from GraphQL type definitions.
 */

export class DsqlBaseSchemaGeneratorPlugin extends TypesGeneratorBase {
  private _columnEnums: Set<string> | null = null;
  private _keyTargets: Map<string, Map<string, ObjectNode | null>> | null = null;
  private _options: DsqlBaseSchemaGeneratorPluginOptions;

  private _imports = new Set<string>();
  private _localBuilders = new Set<LocalColumnBuilderName>();
  private _typeRefs: TypeReferences = createTypeReferences();
  private _publicDefinitions: Set<string> | null = null;

  private _enums: ts.Node[] = [];
  private _tables: ts.Node[] = [];
  private _relations: ts.Node[] = [];

  constructor(context: ITransformerContext, options: DsqlBaseSchemaGeneratorPluginOptions = {}) {
    super("DsqlBaseSchemaGeneratorPlugin", context);
    this._options = mergeOptions(options);
  }

  private _chainCallExp(
    expr: ts.Expression,
    method: string,
    args: ts.Expression[] = [],
    typeArgs: ts.TypeNode[] | undefined = undefined
  ): ts.Expression {
    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(expr, ts.factory.createIdentifier(method)),
      typeArgs,
      args
    );
  }

  private _callExp(name: string, args: ts.Expression[] = []): ts.Expression {
    return ts.factory.createCallExpression(ts.factory.createIdentifier(name), undefined, args);
  }

  private _exportExp(name: string, initializer: ts.Expression): ts.VariableStatement {
    return ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [ts.factory.createVariableDeclaration(name, undefined, undefined, initializer)],
        ts.NodeFlags.Const
      )
    );
  }

  private _shouldSkipField(field: FieldNode): boolean {
    return isInternal(field) || isClientOnly(field) || isRelationField(field);
  }

  /**
   * Enums that back a column: a non-list field of a stored model. A list of enums is a `json` column typed with the enum's TS type, so it needs no `$enum`.
   */
  private _collectColumnEnums() {
    const enums = new Set<string>();

    for (const node of this.context.document.definitions.values()) {
      if (!isObjectNode(node) || !isDsqlBaseTable(node, this.context.options)) continue;

      for (const field of node.fields ?? []) {
        if (this._shouldSkipField(field) || isListTypeNode(field.type)) continue;

        const target = this.context.document.getNode(field.type.getTypeName());

        if (target && isEnumNode(target)) {
          enums.add(target.name);
        }
      }
    }

    return enums;
  }

  private _generateEnum(definition: EnumNode) {
    if (!definition.values?.length) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Enum type ${definition.name} must have at least one value.`
      );
    }

    this._imports.add("$enum");

    const enumDbName = snakeCase(definition.name, "enum");
    const enumVarName = camelCase(definition.name, "enum");
    const values = definition.values.map((v) => ts.factory.createStringLiteral(v.name));

    const initializer = this._callExp("$enum", [
      ts.factory.createStringLiteral(enumDbName),
      ts.factory.createArrayLiteralExpression(values),
    ]);

    this._enums.push(this._exportExp(enumVarName, initializer));
  }

  /**
   * Per table, its relation key columns and the model whose ids each holds: a `@belongsTo` key holds its target's ids, a
   * `@hasOne` / `@hasMany` key its source's. `null` for a key to a union, whose node is per row (polymorphic relations).
   */
  private _collectKeyTargets() {
    const keyTargets = new Map<string, Map<string, ObjectNode | null>>();

    const add = (holder: ObjectNode, key: string, target: ObjectNode | null) => {
      const keys = keyTargets.get(holder.name) ?? new Map<string, ObjectNode | null>();
      keys.set(key, target);
      keyTargets.set(holder.name, keys);
    };

    for (const node of this.context.document.definitions.values()) {
      if (!isObjectNode(node) || !isModel(node)) continue;

      for (const field of node.fields ?? []) {
        if (!isRelationField(field)) continue;

        const target = this._resolveFieldRelationTarget(field);

        if (!isObjectNode(target) && !isUnionNode(target)) continue;

        const key = parseFieldRelation(node, field, target)?.key;

        if (!key) continue;

        if (isBelongsToRelationship(field)) {
          add(node, key, isObjectNode(target) ? target : null);
          continue;
        }

        const holders = isUnionNode(target)
          ? (target.types ?? []).map((type) => this.context.document.getNode(type.getTypeName()))
          : [target];

        for (const holder of holders) {
          if (holder && isObjectNode(holder)) add(holder, key, node);
        }
      }
    }

    return keyTargets;
  }

  /**
   * A dsqlbase node: a table whose primary key is a `GUID`, so ids name it by its schema alias.
   */
  private _isNode(node: ObjectNode): boolean {
    return (
      isDsqlBaseTable(node, this.context.options) &&
      node.getField("id")?.type.getTypeName() === BaseScalar.GUID
    );
  }

  /**
   * The column for a relation key or a `GUID` field, or `null` to resolve it as usual. A key holding a node's ids is
   * `guid(col, "<alias>")` whatever its own type (a tenancy claim keeps its declared one), so the pair agrees. A key to
   * a `GUID` model in another data source is `text`: that source owns its ids, so the column keeps one as it is given.
   * A `GUID` key to a union is a plain `uuid` until polymorphic relations. `GUID` identifies models, so any other `GUID`
   * field throws.
   */
  private _keyColumn(node: ObjectNode, field: FieldNode, columnName: string): ts.Expression | null {
    const isGuid = field.type.getTypeName() === BaseScalar.GUID;
    const keys = (this._keyTargets ??= this._collectKeyTargets()).get(node.name);

    if (keys?.has(field.name)) {
      const target = keys.get(field.name);

      if (target && this._isNode(target)) {
        this._imports.add("guid");

        return this._callExp("guid", [
          ts.factory.createStringLiteral(columnName),
          ts.factory.createStringLiteral(pluralize(camelCase(target.name))),
        ]);
      }

      if (
        target &&
        !isDsqlBaseTable(target, this.context.options) &&
        target.getField("id")?.type.getTypeName() === BaseScalar.GUID
      ) {
        this._imports.add("text");
        return this._callExp("text", [ts.factory.createStringLiteral(columnName)]);
      }

      if (isGuid) {
        this._imports.add("uuid");
        return this._callExp("uuid", [ts.factory.createStringLiteral(columnName)]);
      }

      return null;
    }

    if (isGuid && !isPrimaryKeyField(field)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${node.name}.${field.name} is a GUID, which identifies a model: only a model's id and relation keys can be GUID. Use UUID or ID.`
      );
    }

    return null;
  }

  private _resolveScalarColumnType(typeName: string): ScalarConfig {
    let columnType = resolveScalarDataType(typeName, this._options?.scalarMap);

    if (!columnType) {
      const typeNode = this.context.document.getNodeOrThrow(typeName);

      if (isScalarNode(typeNode)) {
        const hint = getTypeHint(typeNode);
        columnType = resolveTypeHintDataType(hint);
      }
    }

    if (!columnType) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Unsupported scalar type "${typeName}". Please provide a mapping via options.scalarMap or ensure the scalar has a valid @gqlbase_typehint.`
      );
    }

    return columnType;
  }

  private _resolveScalarDataType(typeName: string, columnName: string): ts.Expression {
    const columnType = this._resolveScalarColumnType(typeName);

    if (isLocalColumnBuilder(columnType.dataType)) {
      this._localBuilders.add(columnType.dataType);
    } else {
      this._imports.add(columnType.dataType);
    }

    const args: ts.Expression[] = [ts.factory.createStringLiteral(columnName)];

    if (columnType.options) {
      args.push(jsonToObjectAst(columnType.options as JsonValue));
    }

    return this._callExp(columnType.dataType, args);
  }

  private _applyColumnConstraints(column: ts.Expression, field: FieldNode): ts.Expression {
    let expression = column;

    if (isPrimaryKeyField(field)) {
      expression = this._chainCallExp(expression, "primaryKey");
      expression = this._chainCallExp(expression, "defaultRandom");
      return expression;
    }

    if (!isSemanticNullable(field)) {
      expression = this._chainCallExp(expression, "notNull");
    }

    if (isUnique(field)) {
      expression = this._chainCallExp(expression, "unique");
    }

    return expression;
  }

  private _generateColumn(node: ObjectNode, field: FieldNode): ts.Expression {
    const fieldTypeName = field.type.getTypeName();
    const columnName = snakeCase(field.name);
    const keyColumn = this._keyColumn(node, field, columnName);

    if (keyColumn) {
      return this._applyColumnConstraints(keyColumn, field);
    }

    const typeDef = this.context.document.getNode(fieldTypeName);

    if (isListTypeNode(field.type)) {
      this._imports.add("json");

      if (isBuildInScalar(fieldTypeName) || (typeDef && isScalarNode(typeDef))) {
        const columnType = this._resolveScalarColumnType(fieldTypeName);

        const column = this._callExp("json", [ts.factory.createStringLiteral(columnName)]);
        const valueType = ts.factory.createArrayTypeNode(
          ts.factory.createTypeReferenceNode(columnType.type)
        );

        return this._chainCallExp(
          this._applyColumnConstraints(column, field),
          "$type",
          [],
          [valueType]
        );
      }

      if (!typeDef) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Type "${fieldTypeName}" for field "${field.name}" not found in document.`
        );
      }

      this._referenceType(
        fieldTypeName,
        this._typeRefs,
        (this._publicDefinitions ??= collectPublicDefinitions(this.context))
      );

      const column = this._callExp("json", [ts.factory.createStringLiteral(columnName)]);
      const columnType = ts.factory.createArrayTypeNode(this._createNamedTypeNode(fieldTypeName));

      return this._chainCallExp(
        this._applyColumnConstraints(column, field),
        "$type",
        [],
        [columnType]
      );
    }

    if (isBuildInScalar(fieldTypeName)) {
      const column = this._resolveScalarDataType(fieldTypeName, columnName);
      return this._applyColumnConstraints(column, field);
    }

    if (!typeDef) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type "${fieldTypeName}" for field "${field.name}" not found in document.`
      );
    }

    if (isScalarNode(typeDef)) {
      const column = this._resolveScalarDataType(fieldTypeName, columnName);
      return this._applyColumnConstraints(column, field);
    }

    if (isEnumNode(typeDef)) {
      const enumName = camelCase(fieldTypeName, "enum");
      const column = this._chainCallExp(ts.factory.createIdentifier(enumName), "column", [
        ts.factory.createStringLiteral(columnName),
      ]);

      return this._applyColumnConstraints(column, field);
    }

    if (isObjectLike(typeDef) && !isModel(typeDef) && !isOperationNode(typeDef)) {
      this._imports.add("json");
      this._referenceType(
        fieldTypeName,
        this._typeRefs,
        (this._publicDefinitions ??= collectPublicDefinitions(this.context))
      );

      const column = this._callExp("json", [ts.factory.createStringLiteral(columnName)]);
      const columnType = this._createNamedTypeNode(fieldTypeName);

      return this._chainCallExp(
        this._applyColumnConstraints(column, field),
        "$type",
        [],
        [columnType]
      );
    }

    throw new TransformerPluginExecutionError(
      this.name,
      `Unsupported field type "${fieldTypeName}" for field "${field.name}".`
    );
  }

  private _resolveFieldRelationTarget(field: FieldNode): DefinitionNode {
    const target = this.context.document.getNodeOrThrow(field.type.getTypeName());

    if (isBelongsToRelationship(field) || isOneRelationship(field)) {
      return target;
    }

    if (isManyRelationship(field)) {
      if (!isObjectNode(target)) {
        return target;
      }

      if (isRelayConnection(target)) {
        const edgeTypeName = target.getField("edges")?.type.getTypeName();

        if (edgeTypeName) {
          const edgeNode = this.context.document.getNodeOrThrow(edgeTypeName);

          if (isObjectNode(edgeNode) && isRelayEdge(edgeNode)) {
            const nodeTypeName = edgeNode.getField("node")?.type.getTypeName();

            if (nodeTypeName) {
              return this.context.document.getNodeOrThrow(nodeTypeName);
            }
          }
        }
      }
    }

    return target;
  }

  private _generateFieldRelation(
    type: string,
    sourceTableName: string,
    targetTableName: string,
    sourceField: string,
    targetField: string
  ): ts.Expression {
    return this._callExp(type, [
      ts.factory.createIdentifier(targetTableName),
      ts.factory.createObjectLiteralExpression(
        [
          ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier("from"),
            ts.factory.createArrayLiteralExpression([
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(sourceTableName),
                  ts.factory.createIdentifier("columns")
                ),
                ts.factory.createIdentifier(sourceField)
              ),
            ])
          ),
          ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier("to"),
            ts.factory.createArrayLiteralExpression([
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(targetTableName),
                  ts.factory.createIdentifier("columns")
                ),
                ts.factory.createIdentifier(targetField)
              ),
            ])
          ),
        ],
        true
      ),
    ]);
  }

  private _generateRelations(node: ObjectNode, tableVarName: string) {
    const relations: ts.PropertyAssignment[] = [];

    for (const field of node.fields ?? []) {
      if (isClientOnly(field) || !isRelationField(field)) {
        continue;
      }

      const target = this._resolveFieldRelationTarget(field);

      if (!isModel(target)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Relation field "${field.name}" on type "${node.name}" must reference a model object type. Found "${target.name}" of kind "${target.kind}".`
        );
      }

      // Keyed as usual, but the target is stored in another data source: there is no table to relate to.
      if (!isDsqlBaseTable(target, this.context.options)) {
        continue;
      }

      const relation = parseFieldRelation(node, field, target);
      const targetTableVarName = pluralize(camelCase(target.name));

      if (!relation?.key) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Unable to parse relation for field "${field.name}" on type "${node.name}". Ensure the field references a valid model and follows supported relation patterns.`
        );
      }

      if (isBelongsToRelationship(field)) {
        this._imports.add("belongsTo");

        relations.push(
          ts.factory.createPropertyAssignment(
            field.name,
            this._generateFieldRelation(
              "belongsTo",
              tableVarName,
              targetTableVarName,
              relation.key,
              "id"
            )
          )
        );
      }

      if (isOneRelationship(field)) {
        this._imports.add("hasOne");

        relations.push(
          ts.factory.createPropertyAssignment(
            field.name,
            this._generateFieldRelation(
              "hasOne",
              tableVarName,
              targetTableVarName,
              "id",
              relation.key
            )
          )
        );
      }

      if (isManyRelationship(field)) {
        this._imports.add("hasMany");

        relations.push(
          ts.factory.createPropertyAssignment(
            field.name,
            this._generateFieldRelation(
              "hasMany",
              tableVarName,
              targetTableVarName,
              "id",
              relation.key
            )
          )
        );
      }
    }

    if (relations.length) {
      this._imports.add("relations");

      const relation = this._callExp("relations", [
        ts.factory.createIdentifier(tableVarName),
        ts.factory.createObjectLiteralExpression(relations, true),
      ]);

      this._relations.push(this._exportExp(camelCase(node.name, "relations"), relation));
    }
  }

  /**
   * `(c) => [c.a, c.b]`: the column callback the dsqlbase table builders take.
   */
  private _columnsCallback(columns: ts.Expression[]): ts.ArrowFunction {
    return ts.factory.createArrowFunction(
      undefined,
      undefined,
      [ts.factory.createParameterDeclaration(undefined, undefined, "c")],
      undefined,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      ts.factory.createArrayLiteralExpression(columns)
    );
  }

  private _columnRef(field: string): ts.Expression {
    return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("c"), field);
  }

  private _indexColumnRef(column: DsqlIndexColumn): ts.Expression {
    let expression = this._columnRef(column.field);

    if (column.nulls) {
      expression = this._chainCallExp(
        expression,
        column.nulls === "FIRST" ? "nullsFirst" : "nullsLast"
      );
    }

    return expression;
  }

  /**
   * One statement per `@index` and `@unique(fields:)`, after the table: the builders return the index or constraint, not
   * the table, so they cannot be chained onto `table(...)`.
   */
  private _generateTableConstraints(node: ObjectNode, tableVarName: string) {
    const table = ts.factory.createIdentifier(tableVarName);

    for (const index of getIndexes(node)) {
      const args: ts.Expression[] = [ts.factory.createStringLiteral(index.name)];

      if (index.unique) {
        args.push(
          ts.factory.createObjectLiteralExpression([
            ts.factory.createPropertyAssignment("unique", ts.factory.createTrue()),
          ])
        );
      }

      let expression = this._chainCallExp(this._chainCallExp(table, "index", args), "columns", [
        this._columnsCallback(index.columns.map((column) => this._indexColumnRef(column))),
      ]);

      if (index.include?.length) {
        expression = this._chainCallExp(expression, "include", [
          this._columnsCallback(index.include.map((field) => this._columnRef(field))),
        ]);
      }

      if (index.distinctNulls !== undefined && index.distinctNulls !== null) {
        expression = this._chainCallExp(expression, "distinctNulls", [
          index.distinctNulls ? ts.factory.createTrue() : ts.factory.createFalse(),
        ]);
      }

      this._tables.push(ts.factory.createExpressionStatement(expression));
    }

    for (const fields of getUniqueConstraints(node)) {
      this._tables.push(
        ts.factory.createExpressionStatement(
          this._chainCallExp(table, "unique", [
            this._columnsCallback(fields.map((field) => this._columnRef(field))),
          ])
        )
      );
    }
  }

  private _generateTable(node: ObjectNode) {
    this._imports.add("table");

    const tableName = pluralize(snakeCase(node.name));
    const tableVarName = pluralize(camelCase(node.name));

    const columns: ts.ObjectLiteralElementLike[] = [];

    for (const field of node.fields ?? []) {
      if (this._shouldSkipField(field)) {
        continue;
      }

      const column = this._generateColumn(node, field);
      columns.push(ts.factory.createPropertyAssignment(field.name, column));
    }

    // `__typename` on every row's `$$meta`: `$$key` names the schema alias, a resolver returns the type name.
    const tableDef = this._chainCallExp(
      this._callExp("table", [
        ts.factory.createStringLiteral(tableName),
        ts.factory.createObjectLiteralExpression(columns, true),
      ]),
      "meta",
      [
        ts.factory.createObjectLiteralExpression([
          // `as const`: `meta()` does not keep literal types, and the typename narrows the row.
          ts.factory.createPropertyAssignment(
            "__typename",
            ts.factory.createAsExpression(
              ts.factory.createStringLiteral(node.name),
              ts.factory.createTypeReferenceNode("const")
            )
          ),
        ]),
      ]
    );

    this._tables.push(this._exportExp(tableVarName, tableDef));
    this._generateTableConstraints(node, tableVarName);
    this._generateRelations(node, tableVarName);
  }

  public before() {
    this._columnEnums = null;
    this._keyTargets = null;
    this._enums = [];
    this._tables = [];
    this._relations = [];
    this._imports.clear();
    this._localBuilders.clear();
    this._typeRefs = createTypeReferences();
    this._publicDefinitions = null;
  }

  public match(node: DefinitionNode): boolean {
    return (
      !isOperationNode(node) &&
      !isInternal(node) &&
      !isScalarNode(node) &&
      !isDirectiveDefinitionNode(node)
    );
  }

  public generate(definition: DefinitionNode) {
    if (isEnumNode(definition)) {
      // Collected on the first call: execute has finished, and nothing changes the document during generate.
      this._columnEnums ??= this._collectColumnEnums();

      return this._columnEnums.has(definition.name) ? this._generateEnum(definition) : undefined;
    }

    // A client-only model is never stored, and a model in another data source is stored elsewhere.
    if (isObjectNode(definition) && isDsqlBaseTable(definition, this.context.options)) {
      return this._generateTable(definition);
    }
  }

  public output() {
    const importNodes: ts.Node[] = [];

    const imports = Array.from(this._imports);
    const { imports: typeImports, declarations } = this._typeRefs;
    const reExports = Array.from(typeImports);

    if (imports.length > 0) {
      importNodes.push(namedImportStatement("dsqlbase/schema", imports));
    }

    if (this._localBuilders.size > 0) {
      importNodes.push(createLocalColumnBuilderImport());
    }

    // Locally declared types (for stored shapes the schema types do not export) use Maybe.
    const schemaTypeImports = declarations.size > 0 ? [...reExports, "Maybe"] : reExports;

    if (schemaTypeImports.length > 0) {
      importNodes.push(namedImportStatement("../schema.types.js", schemaTypeImports, true));
    }

    if (reExports.length > 0) {
      importNodes.push(
        ts.factory.createExportDeclaration(
          undefined,
          true,
          ts.factory.createNamedExports(
            reExports.map((name) =>
              ts.factory.createExportSpecifier(false, undefined, ts.factory.createIdentifier(name))
            )
          ),
          ts.factory.createStringLiteral("../schema.types.js")
        )
      );
    }

    const content = printNodeList(
      ts.factory.createNodeArray([
        ...importNodes,
        ts.factory.createIdentifier("\n"),
        ...Array.from(this._localBuilders, createLocalColumnBuilder),
        ...declarations.values(),
        ...this._enums,
        ...this._tables,
        ...this._relations,
      ])
    );

    this.context.files.push({
      type: "ts",
      path: "dsqlbase/schema.ts",
      filename: "schema.ts",
      content,
    });

    return this._options.emitOutput ? { dsqlBaseSchema: content } : {};
  }
}

export const dsqlbaseSchemaGeneratorPlugin = createPluginFactory(DsqlBaseSchemaGeneratorPlugin);
