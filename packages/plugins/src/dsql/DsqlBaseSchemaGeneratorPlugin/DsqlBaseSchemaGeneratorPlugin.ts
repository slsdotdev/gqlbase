import ts from "typescript";
import { ITransformerContext } from "@gqlbase/core";
import {
  DefinitionNode,
  EnumNode,
  FieldNode,
  InterfaceNode,
  isDirectiveDefinitionNode,
  isEnumNode,
  isListTypeNode,
  isObjectLike,
  isObjectNode,
  isOperationNode,
  isScalarNode,
  isInterfaceNode,
  isUnionNode,
  ObjectNode,
  UnionNode,
} from "@gqlbase/core/definition";
import {
  BaseScalar,
  createPluginFactory,
  getTypeHint,
  isInternal,
  isClientOnly,
  isEmbedded,
  isModel,
  isRelationField,
  getRelationMembers,
  type RelationTarget,
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
  private _discriminators: Map<string, Map<string, string[]>> | null = null;
  private _unions: ts.Node[] = [];
  private _unionNames = new Set<string>();
  private _embedded: ts.Node[] = [];
  private _embeddedNames = new Set<string>();
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
   * Enums that back a column: a non-list field of a stored model, or of an `@embedded` type one stores. A list of enums is
   * an `array()` column typed with the enum's TS type, so it needs no `$enum`.
   */
  private _collectColumnEnums() {
    const enums = new Set<string>();

    const collect = (node: ObjectNode) => {
      for (const field of node.fields ?? []) {
        if (this._shouldSkipField(field) || isListTypeNode(field.type)) continue;

        const target = this.context.document.getNode(field.type.getTypeName());

        if (target && isEnumNode(target)) {
          enums.add(target.name);
        }

        if (target && isEmbedded(target)) {
          collect(target);
        }
      }
    };

    for (const node of this.context.document.definitions.values()) {
      if (isObjectNode(node) && isDsqlBaseTable(node, this.context.options)) {
        collect(node);
      }
    }

    return enums;
  }

  /**
   * Whether a value of the type always has a column set: a member that is non-null, or a non-null group that has one.
   */
  private _hasRequiredMember(node: ObjectNode): boolean {
    return (node.fields ?? []).some((field) => {
      if (this._shouldSkipField(field) || isSemanticNullable(field)) return false;

      const target = this.context.document.getNode(field.type.getTypeName());

      return isListTypeNode(field.type) || !target || !isEmbedded(target)
        ? true
        : this._hasRequiredMember(target);
    });
  }

  /**
   * `export const <type> = embedded({ ... })`, once per `@embedded` type a stored model uses, before the tables.
   *
   * dsqlbase has no nullability on a group, only on its members, so a nullable field of a type with a required member
   * uses a second shape, `<type>Nullable`, whose members are all nullable: a member column is `NOT NULL` only when the
   * field and the member are both non-null. The generated inputs keep such a group all-or-nothing.
   */
  private _declareEmbedded(node: ObjectNode, nullable: boolean): string {
    const relaxed = nullable && this._hasRequiredMember(node);
    const name = relaxed ? camelCase(node.name, "nullable") : camelCase(node.name);

    if (this._embeddedNames.has(name)) {
      return name;
    }

    if (
      this._unionNames.has(name) ||
      Array.from(this.context.document.definitions.values()).some(
        (definition) =>
          isObjectNode(definition) &&
          isDsqlBaseTable(definition, this.context.options) &&
          this._tableAlias(definition) === name
      )
    ) {
      throw new TransformerPluginExecutionError(
        this.name,
        `@embedded type ${node.name} would be exported as "${name}", which is already a table's schema alias. Rename one of them.`
      );
    }

    this._embeddedNames.add(name);

    const members: ts.ObjectLiteralElementLike[] = [];

    for (const field of node.fields ?? []) {
      if (this._shouldSkipField(field)) continue;

      members.push(
        ts.factory.createPropertyAssignment(field.name, this._generateColumn(node, field, relaxed))
      );
    }

    this._imports.add("embedded");
    this._embedded.push(
      this._exportExp(
        name,
        this._callExp("embedded", [ts.factory.createObjectLiteralExpression(members, true)])
      )
    );

    return name;
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
   * `@hasOne` / `@hasMany` key its source's. `null` for the key of a `@belongsTo` to a union or an interface, whose
   * node is named row by row by its discriminator; a member's reverse relation onto that key does not change it.
   * Also collects each such discriminator, with the schema aliases of the members it can name.
   */
  private _collectKeyTargets() {
    const keyTargets = new Map<string, Map<string, ObjectNode | null>>();
    const discriminators = new Map<string, Map<string, string[]>>();

    const add = (holder: ObjectNode, key: string, target: ObjectNode | null) => {
      const keys = keyTargets.get(holder.name) ?? new Map<string, ObjectNode | null>();

      if (keys.get(key) !== null) {
        keys.set(key, target);
      }

      keyTargets.set(holder.name, keys);
    };

    for (const node of this.context.document.definitions.values()) {
      if (!isObjectNode(node) || !isModel(node)) continue;

      for (const field of node.fields ?? []) {
        if (!isRelationField(field)) continue;

        const target = this._resolveFieldRelationTarget(field);

        if (!isObjectNode(target) && !isUnionNode(target) && !isInterfaceNode(target)) continue;

        const relation = parseFieldRelation(node, field, target);

        if (!relation?.key) continue;

        if (isBelongsToRelationship(field)) {
          add(node, relation.key, isObjectNode(target) ? target : null);

          if (relation.discriminator) {
            const fields = discriminators.get(node.name) ?? new Map<string, string[]>();
            fields.set(
              relation.discriminator,
              getRelationMembers(this.context.document, target).map((member) =>
                this._tableAlias(member)
              )
            );
            discriminators.set(node.name, fields);
          }

          continue;
        }

        for (const holder of getRelationMembers(this.context.document, target)) {
          add(holder, relation.key, node);
        }
      }
    }

    this._discriminators = discriminators;

    return keyTargets;
  }

  private _tableAlias(node: { name: string }): string {
    return pluralize(camelCase(node.name));
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
   * The `GUID` key of a `@belongsTo` to a union or an interface is a keyless `guid`, and its discriminator a `text` typed
   * with the member aliases. `GUID` identifies models, so any other `GUID` field throws.
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

      // A key a discriminator names row by row: keyless, so dsqlbase wraps each id with the member it points at.
      if (target === null && isGuid) {
        this._imports.add("guid");
        return this._callExp("guid", [ts.factory.createStringLiteral(columnName)]);
      }

      return null;
    }

    const members = this._discriminators?.get(node.name)?.get(field.name);

    if (members) {
      this._imports.add("text");

      return this._chainCallExp(
        this._callExp("text", [ts.factory.createStringLiteral(columnName)]),
        "$type",
        [],
        [
          ts.factory.createUnionTypeNode(
            members.map((alias) =>
              ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(alias))
            )
          ),
        ]
      );
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

  private _applyColumnConstraints(
    column: ts.Expression,
    field: FieldNode,
    nullable = false
  ): ts.Expression {
    let expression = column;

    if (isPrimaryKeyField(field)) {
      expression = this._chainCallExp(expression, "primaryKey");
      expression = this._chainCallExp(expression, "defaultRandom");
      return expression;
    }

    if (!nullable && !isSemanticNullable(field)) {
      expression = this._chainCallExp(expression, "notNull");
    }

    if (isUnique(field)) {
      expression = this._chainCallExp(expression, "unique");
    }

    return expression;
  }

  /**
   * The column for a field of a table, or a member of an `@embedded` type. `nullable` drops `.notNull()`, for the members
   * of a group that a nullable field holds.
   */
  private _generateColumn(node: ObjectNode, field: FieldNode, nullable = false): ts.Expression {
    const fieldTypeName = field.type.getTypeName();
    const columnName = snakeCase(field.name);
    const keyColumn = this._keyColumn(node, field, columnName);

    if (keyColumn) {
      return this._applyColumnConstraints(keyColumn, field, nullable);
    }

    const typeDef = this.context.document.getNode(fieldTypeName);

    // A list is a `jsonb` array, whatever its items, embedded types included.
    if (isListTypeNode(field.type)) {
      this._imports.add("array");

      if (isBuildInScalar(fieldTypeName) || (typeDef && isScalarNode(typeDef))) {
        const columnType = this._resolveScalarColumnType(fieldTypeName);

        const column = this._callExp("array", [ts.factory.createStringLiteral(columnName)]);
        const valueType = ts.factory.createArrayTypeNode(
          ts.factory.createTypeReferenceNode(columnType.type)
        );

        return this._chainCallExp(
          this._applyColumnConstraints(column, field, nullable),
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

      const column = this._callExp("array", [ts.factory.createStringLiteral(columnName)]);
      const columnType = ts.factory.createArrayTypeNode(this._createNamedTypeNode(fieldTypeName));

      return this._chainCallExp(
        this._applyColumnConstraints(column, field, nullable),
        "$type",
        [],
        [columnType]
      );
    }

    if (isBuildInScalar(fieldTypeName)) {
      const column = this._resolveScalarDataType(fieldTypeName, columnName);
      return this._applyColumnConstraints(column, field, nullable);
    }

    if (!typeDef) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type "${fieldTypeName}" for field "${field.name}" not found in document.`
      );
    }

    if (isScalarNode(typeDef)) {
      const column = this._resolveScalarDataType(fieldTypeName, columnName);
      return this._applyColumnConstraints(column, field, nullable);
    }

    if (isEnumNode(typeDef)) {
      const enumName = camelCase(fieldTypeName, "enum");
      const column = this._chainCallExp(ts.factory.createIdentifier(enumName), "column", [
        ts.factory.createStringLiteral(columnName),
      ]);

      return this._applyColumnConstraints(column, field, nullable);
    }

    // A group of columns, `<field>_<member>`; it has no constraints of its own.
    if (isEmbedded(typeDef)) {
      const shape = this._declareEmbedded(typeDef, nullable || isSemanticNullable(field));

      return this._chainCallExp(ts.factory.createIdentifier(shape), "column", [
        ts.factory.createStringLiteral(columnName),
      ]);
    }

    // Any other object, interface or union is a `jsonb` document.
    if (isObjectLike(typeDef) && !isModel(typeDef) && !isOperationNode(typeDef)) {
      this._imports.add("record");
      this._referenceType(
        fieldTypeName,
        this._typeRefs,
        (this._publicDefinitions ??= collectPublicDefinitions(this.context))
      );

      const column = this._callExp("record", [ts.factory.createStringLiteral(columnName)]);
      const columnType = this._createNamedTypeNode(fieldTypeName);

      return this._chainCallExp(
        this._applyColumnConstraints(column, field, nullable),
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

  private _columnAccess(tableVarName: string, column: string): ts.Expression {
    return ts.factory.createPropertyAccessExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(tableVarName),
        ts.factory.createIdentifier("columns")
      ),
      ts.factory.createIdentifier(column)
    );
  }

  /**
   * `export const <alias> = union({ <member aliases> })`, once per union or interface a relation targets.
   */
  private _declareUnion(target: RelationTarget, members: ObjectNode[]): string {
    const alias = this._tableAlias(target);

    if (this._unionNames.has(alias)) {
      return alias;
    }

    if (
      Array.from(this.context.document.definitions.values()).some(
        (definition) =>
          isObjectNode(definition) &&
          isDsqlBaseTable(definition, this.context.options) &&
          this._tableAlias(definition) === alias
      )
    ) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${target.name} would be exported as "${alias}", which is already a table's schema alias. Rename one of them.`
      );
    }

    this._imports.add("union");
    this._unionNames.add(alias);
    this._unions.push(
      this._exportExp(
        alias,
        this._callExp("union", [
          ts.factory.createObjectLiteralExpression(
            members.map((member) =>
              ts.factory.createShorthandPropertyAssignment(this._tableAlias(member))
            )
          ),
        ])
      )
    );

    return alias;
  }

  /**
   * A relation to a union or an interface: a dsqlbase `union()` of its members. A `@belongsTo` stores the key and the
   * discriminator naming the member; a `@hasOne` / `@hasMany` finds its key on each member. `null` when a member is not
   * a table of this source: the relation is resolved elsewhere, as for an object target in another data source.
   */
  private _generatePolymorphicRelation(
    node: ObjectNode,
    field: FieldNode,
    target: InterfaceNode | UnionNode,
    tableVarName: string
  ): ts.Expression | null {
    const members = getRelationMembers(this.context.document, target);
    const relation = parseFieldRelation(node, field, target);

    if (
      !relation?.key ||
      !members.length ||
      !members.every((member) => isDsqlBaseTable(member, this.context.options))
    ) {
      return null;
    }

    const unionVarName = this._declareUnion(target, members);

    if (isBelongsToRelationship(field) && relation.discriminator) {
      this._imports.add("belongsTo");

      return this._callExp("belongsTo", [
        ts.factory.createIdentifier(unionVarName),
        ts.factory.createObjectLiteralExpression(
          [
            ts.factory.createPropertyAssignment(
              "from",
              ts.factory.createArrayLiteralExpression([
                this._columnAccess(tableVarName, relation.key),
              ])
            ),
            ts.factory.createPropertyAssignment(
              "to",
              ts.factory.createArrayLiteralExpression([this._columnAccess(unionVarName, "id")])
            ),
            ts.factory.createPropertyAssignment(
              "discriminator",
              this._columnAccess(tableVarName, relation.discriminator)
            ),
          ],
          true
        ),
      ]);
    }

    const type = isManyRelationship(field) ? "hasMany" : "hasOne";
    this._imports.add(type);

    return this._callExp(type, [
      ts.factory.createIdentifier(unionVarName),
      ts.factory.createObjectLiteralExpression(
        [
          ts.factory.createPropertyAssignment(
            "from",
            ts.factory.createArrayLiteralExpression([this._columnAccess(tableVarName, "id")])
          ),
          ts.factory.createPropertyAssignment(
            "to",
            ts.factory.createObjectLiteralExpression(
              members.map((member) => {
                const memberVarName = this._tableAlias(member);

                return ts.factory.createPropertyAssignment(
                  memberVarName,
                  ts.factory.createArrayLiteralExpression([
                    this._columnAccess(memberVarName, relation.key as string),
                  ])
                );
              })
            )
          ),
        ],
        true
      ),
    ]);
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

      if (isUnionNode(target) || isInterfaceNode(target)) {
        const relation = this._generatePolymorphicRelation(node, field, target, tableVarName);

        if (relation) {
          relations.push(ts.factory.createPropertyAssignment(field.name, relation));
        }

        continue;
      }

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

  /**
   * `c.<field>`, or `c.<field>.<member>` for a dotted path into an `@embedded` field.
   */
  private _columnRef(field: string): ts.Expression {
    return field
      .split(".")
      .reduce<ts.Expression>(
        (expression, name) => ts.factory.createPropertyAccessExpression(expression, name),
        ts.factory.createIdentifier("c")
      );
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
    this._discriminators = null;
    this._unions = [];
    this._unionNames.clear();
    this._embedded = [];
    this._embeddedNames.clear();
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
        ...this._embedded,
        ...this._tables,
        ...this._unions,
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
