import { ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  EnumNode,
  DirectiveNode,
  InputObjectNode,
  InputValueNode,
  isListTypeNode,
  isObjectNode,
  isScalarNode,
  isEnumNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  ValueNode,
} from "@gqlbase/core/definition";
import {
  createPluginFactory,
  InternalDirective,
  isClientOnly,
  isInternal,
  isModel,
  isPrimaryKeyField,
  isRelationField,
} from "@gqlbase/core/plugins";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import {
  DSQL_INDEX_COLUMN,
  DSQL_NULLS_ORDER,
  DSQLBASE_DATA_SOURCE_TYPE,
  DsqlBaseDirective,
  getIndexes,
  isDsqlBaseTable,
  isEmbedded,
  getUniqueConstraints,
} from "./DsqlBaseUtilsPlugin.utils.js";

/**
 * Declares the dsqlbase table directives: indexes and unique constraints, mirroring the dsqlbase schema builders.
 *
 * @definition
 * ```graphql
 * enum DsqlNullsOrder { FIRST LAST }
 * input DsqlIndexColumn { field: String!, nulls: DsqlNullsOrder }
 *
 * directive `@index(name: String!, columns: [DsqlIndexColumn!]!, unique: Boolean = false, include: [String!], distinctNulls: Boolean)` repeatable on OBJECT
 * directive `@unique(fields: [String!])` repeatable on OBJECT | FIELD_DEFINITION
 * directive `@embedded` on OBJECT
 * ```
 *
 * - `@index` → `table.index(name, { unique }).columns(...).include(...).distinctNulls(...)`
 * - `@unique` on a field → `column.unique()`; on a type, with `fields` → `table.unique((c) => [...])`
 * - `@embedded` → an `embedded({...})` shape, stored as columns of each table that uses it. The type is marked
 *   `@gqlbase_sortable`, so `orderBy` reaches its members.
 *
 * Fields are checked in `execute`, once relation keys and tenancy claims exist: each must be a column of the table.
 */

export class DsqlBaseUtilsPlugin extends TransformerPluginBase {
  // Index name → the model declaring it. Index names are unique per schema, like Postgres index names per schema.
  private _indexNames = new Map<string, string>();

  constructor(context: ITransformerContext) {
    super("DsqlBaseUtilsPlugin", context);

    const sources = Object.entries(context.options.dataSources)
      .filter(([, source]) => source.type === DSQLBASE_DATA_SOURCE_TYPE)
      .map(([name]) => name);

    if (sources.length > 1) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Only one data source can have type "${DSQLBASE_DATA_SOURCE_TYPE}"; ${sources.join(", ")} do.`
      );
    }
  }

  public init() {
    const internal = () => [DirectiveNode.create(InternalDirective.INTERNAL)];

    this.context.base
      .addNode(EnumNode.create(DSQL_NULLS_ORDER, undefined, internal(), ["FIRST", "LAST"]))
      .addNode(
        InputObjectNode.create(DSQL_INDEX_COLUMN, undefined, undefined, [
          InputValueNode.create("field", undefined, undefined, NonNullTypeNode.create("String")),
          InputValueNode.create(
            "nulls",
            undefined,
            undefined,
            NamedTypeNode.create(DSQL_NULLS_ORDER)
          ),
        ])
      )
      .addNode(
        DirectiveDefinitionNode.create(
          DsqlBaseDirective.INDEX,
          undefined,
          ["OBJECT"],
          [
            InputValueNode.create("name", undefined, undefined, NonNullTypeNode.create("String")),
            InputValueNode.create(
              "columns",
              undefined,
              undefined,
              NonNullTypeNode.create(ListTypeNode.create(NonNullTypeNode.create(DSQL_INDEX_COLUMN)))
            ),
            InputValueNode.create(
              "unique",
              undefined,
              undefined,
              NamedTypeNode.create("Boolean"),
              ValueNode.boolean(false)
            ),
            InputValueNode.create(
              "include",
              undefined,
              undefined,
              ListTypeNode.create(NonNullTypeNode.create("String"))
            ),
            InputValueNode.create(
              "distinctNulls",
              undefined,
              undefined,
              NamedTypeNode.create("Boolean")
            ),
          ],
          true
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          DsqlBaseDirective.UNIQUE,
          undefined,
          ["OBJECT", "FIELD_DEFINITION"],
          [
            InputValueNode.create(
              "fields",
              undefined,
              undefined,
              ListTypeNode.create(NonNullTypeNode.create("String"))
            ),
          ],
          true
        )
      )
      .addNode(DirectiveDefinitionNode.create(DsqlBaseDirective.EMBEDDED, undefined, ["OBJECT"]));
  }

  /**
   * An `@embedded` type is a value: it is not a model, has no `id` and no relations, and does not contain itself, since its
   * members become columns of the table that uses it.
   */
  private _checkEmbedded(definition: ObjectNode, path: string[]) {
    if (path.length === 1 && isModel(definition)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Type ${definition.name} cannot be both @model and @embedded.`
      );
    }

    for (const field of definition.fields ?? []) {
      if (path.length === 1 && (isPrimaryKeyField(field) || isRelationField(field))) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Field ${definition.name}.${field.name} cannot be on an @embedded type, which has no id and no relations.`
        );
      }

      const member = this.context.document.getNode(field.type.getTypeName());

      if (isListTypeNode(field.type) || !member || !isEmbedded(member)) continue;

      if (path.includes(member.name)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `@embedded type ${member.name} contains itself (${[...path, member.name].join(" > ")}).`
        );
      }

      this._checkEmbedded(member, [...path, member.name]);
    }
  }

  /**
   * A field a table directive can name: a column of the table, so not a relation, not `@clientOnly`, and not a `jsonb`
   * column (lists and other objects), which DSQL cannot index. A dotted path (`price.amount`) names a member of an
   * `@embedded` field, which is a column too.
   */
  private _checkColumn(model: ObjectNode, name: string, directive: string) {
    const where = `@${directive} on ${model.name}`;
    const path = name.split(".");
    let owner = model;

    for (const segment of path.slice(0, -1)) {
      const field = owner.getField(segment);
      const typeDef = field && this.context.document.getNode(field.type.getTypeName());

      if (
        !field ||
        isInternal(field) ||
        isClientOnly(field) ||
        isListTypeNode(field.type) ||
        !typeDef ||
        !isEmbedded(typeDef)
      ) {
        throw new TransformerPluginExecutionError(
          this.name,
          `${where} names "${name}", but ${owner.name}.${segment} is not an @embedded field.`
        );
      }

      owner = typeDef;
    }

    const leaf = path[path.length - 1] ?? name;
    const field = owner.getField(leaf);

    if (!field || isInternal(field)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${where} names "${name}", which is not a field of ${owner.name}.`
      );
    }

    if (isRelationField(field) || isClientOnly(field)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${where} names ${name}, which is not stored as a column. Name its key field instead.`
      );
    }

    const typeName = field.type.getTypeName();
    const typeDef = this.context.document.getNode(typeName);
    const isValue =
      isBuildInScalar(typeName) || (typeDef && (isScalarNode(typeDef) || isEnumNode(typeDef)));

    if (typeDef && isEmbedded(typeDef) && !isListTypeNode(field.type)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${where} names ${name}, a group of columns. Name its members instead (${name}.<member>).`
      );
    }

    if (isListTypeNode(field.type) || !isValue) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${where} names ${name}, a jsonb column, which DSQL cannot index.`
      );
    }
  }

  private _checkModel(model: ObjectNode) {
    for (const index of getIndexes(model)) {
      const owner = this._indexNames.get(index.name);

      if (owner) {
        throw new TransformerPluginExecutionError(
          this.name,
          `Index name "${index.name}" is used on both ${owner} and ${model.name}. Index names are unique per schema.`
        );
      }

      this._indexNames.set(index.name, model.name);

      if (!index.columns.length) {
        throw new TransformerPluginExecutionError(
          this.name,
          `@index "${index.name}" on ${model.name} has no columns.`
        );
      }

      for (const name of [
        ...index.columns.map((column) => column.field),
        ...(index.include ?? []),
      ]) {
        this._checkColumn(model, name, DsqlBaseDirective.INDEX);
      }
    }

    for (const fields of getUniqueConstraints(model)) {
      if (!fields.length) {
        throw new TransformerPluginExecutionError(
          this.name,
          `@unique on the type ${model.name} needs fields. Put @unique on the field for a single column.`
        );
      }

      for (const name of fields) {
        this._checkColumn(model, name, DsqlBaseDirective.UNIQUE);
      }
    }

    for (const field of model.fields ?? []) {
      const directive = field.getDirective(DsqlBaseDirective.UNIQUE);

      if (!directive) {
        continue;
      }

      if (directive.getArgument("fields")) {
        throw new TransformerPluginExecutionError(
          this.name,
          `@unique on ${model.name}.${field.name} takes no fields. Put @unique(fields: [...]) on the type for a composite constraint.`
        );
      }

      this._checkColumn(model, field.name, DsqlBaseDirective.UNIQUE);
    }
  }

  private _hasTableDirectives(node: ObjectNode) {
    return (
      node.hasDirective(DsqlBaseDirective.INDEX) ||
      node.hasDirective(DsqlBaseDirective.UNIQUE) ||
      (node.fields ?? []).some((field) => field.hasDirective(DsqlBaseDirective.UNIQUE))
    );
  }

  public before() {
    this._indexNames.clear();

    for (const definition of this.context.document.definitions.values()) {
      if (!isEmbedded(definition)) continue;

      this._checkEmbedded(definition, [definition.name]);

      if (!definition.hasDirective(InternalDirective.SORTABLE)) {
        definition.addDirective(DirectiveNode.create(InternalDirective.SORTABLE));
      }
    }
  }

  public match(definition: DefinitionNode): boolean {
    return (
      isObjectNode(definition) && (this._hasTableDirectives(definition) || isEmbedded(definition))
    );
  }

  /**
   * Checks the table directives once relation keys (added in normalize) and tenancy claims (added before it) exist.
   */
  public execute(definition: ObjectNode) {
    // Not `isEmbedded`: its type guard would narrow the definition to `never` below.
    if (definition.hasDirective(DsqlBaseDirective.EMBEDDED)) {
      if (!this._hasTableDirectives(definition)) return;

      throw new TransformerPluginExecutionError(
        this.name,
        `@index and @unique apply to tables, not to the @embedded type ${definition.name}: its members are columns of each model that uses it. Index them there, by path ("<field>.<member>").`
      );
    }

    if (!isDsqlBaseTable(definition, this.context.options)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `@index and @unique apply to dsqlbase tables: a @model that is not @clientOnly, in a "${DSQLBASE_DATA_SOURCE_TYPE}" data source. ${definition.name} is not one.`
      );
    }

    this._checkModel(definition);
  }

  public cleanup(definition: ObjectNode) {
    definition
      .removeDirective(DsqlBaseDirective.INDEX)
      .removeDirective(DsqlBaseDirective.UNIQUE)
      .removeDirective(DsqlBaseDirective.EMBEDDED);

    for (const field of definition.fields ?? []) {
      field.removeDirective(DsqlBaseDirective.UNIQUE);
    }
  }

  public after() {
    this.context.document
      .removeNode(DsqlBaseDirective.INDEX)
      .removeNode(DsqlBaseDirective.UNIQUE)
      .removeNode(DsqlBaseDirective.EMBEDDED)
      .removeNode(DSQL_INDEX_COLUMN)
      .removeNode(DSQL_NULLS_ORDER);
  }
}

export const dsqlBaseUtilsPlugin = createPluginFactory(DsqlBaseUtilsPlugin);
