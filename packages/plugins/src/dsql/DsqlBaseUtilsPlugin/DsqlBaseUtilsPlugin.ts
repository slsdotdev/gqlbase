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
  isRelationField,
} from "@gqlbase/core/plugins";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import {
  DSQL_INDEX_COLUMN,
  DSQL_NULLS_ORDER,
  DSQL_SORT_ORDER,
  DSQLBASE_DATA_SOURCE_TYPE,
  DsqlBaseDirective,
  getIndexes,
  isDsqlBaseTable,
  getUniqueConstraints,
} from "./DsqlBaseUtilsPlugin.utils.js";

/**
 * Declares the dsqlbase table directives: indexes and unique constraints, mirroring the dsqlbase schema builders.
 *
 * @definition
 * ```graphql
 * enum DsqlSortOrder { ASC DESC }
 * enum DsqlNullsOrder { FIRST LAST }
 * input DsqlIndexColumn { field: String!, sort: DsqlSortOrder = ASC, nulls: DsqlNullsOrder }
 *
 * directive `@index(name: String!, columns: [DsqlIndexColumn!]!, unique: Boolean = false, include: [String!], distinctNulls: Boolean)` repeatable on OBJECT
 * directive `@unique(fields: [String!])` repeatable on OBJECT | FIELD_DEFINITION
 * ```
 *
 * - `@index` → `table.index(name, { unique }).columns(...).include(...).distinctNulls(...)`
 * - `@unique` on a field → `column.unique()`; on a type, with `fields` → `table.unique((c) => [...])`
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
      .addNode(EnumNode.create(DSQL_SORT_ORDER, undefined, internal(), ["ASC", "DESC"]))
      .addNode(EnumNode.create(DSQL_NULLS_ORDER, undefined, internal(), ["FIRST", "LAST"]))
      .addNode(
        InputObjectNode.create(DSQL_INDEX_COLUMN, undefined, undefined, [
          InputValueNode.create("field", undefined, undefined, NonNullTypeNode.create("String")),
          InputValueNode.create(
            "sort",
            undefined,
            undefined,
            NamedTypeNode.create(DSQL_SORT_ORDER),
            ValueNode.enum("ASC")
          ),
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
      );
  }

  /**
   * A field a table directive can name: a column of the table, so not a relation, not `@clientOnly`, and not a `json`
   * column (lists and objects), which DSQL cannot index.
   */
  private _checkColumn(model: ObjectNode, name: string, directive: string) {
    const where = `@${directive} on ${model.name}`;

    if (name.includes(".")) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${where} names "${name}". Paths into embedded objects are not supported yet.`
      );
    }

    const field = model.getField(name);

    if (!field || isInternal(field)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${where} names "${name}", which is not a field of ${model.name}.`
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

    if (isListTypeNode(field.type) || !isValue) {
      throw new TransformerPluginExecutionError(
        this.name,
        `${where} names ${name}, a json column, which DSQL cannot index.`
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
  }

  public match(definition: DefinitionNode): boolean {
    return isObjectNode(definition) && this._hasTableDirectives(definition);
  }

  /**
   * Checks the table directives once relation keys (added in normalize) and tenancy claims (added before it) exist.
   */
  public execute(definition: ObjectNode) {
    if (!isDsqlBaseTable(definition, this.context.options)) {
      throw new TransformerPluginExecutionError(
        this.name,
        `@index and @unique apply to dsqlbase tables: a @model that is not @clientOnly, in a "${DSQLBASE_DATA_SOURCE_TYPE}" data source. ${definition.name} is not one.`
      );
    }

    this._checkModel(definition);
  }

  public cleanup(definition: ObjectNode) {
    definition.removeDirective(DsqlBaseDirective.INDEX).removeDirective(DsqlBaseDirective.UNIQUE);

    for (const field of definition.fields ?? []) {
      field.removeDirective(DsqlBaseDirective.UNIQUE);
    }
  }

  public after() {
    this.context.document
      .removeNode(DsqlBaseDirective.INDEX)
      .removeNode(DsqlBaseDirective.UNIQUE)
      .removeNode(DSQL_INDEX_COLUMN)
      .removeNode(DSQL_SORT_ORDER)
      .removeNode(DSQL_NULLS_ORDER);
  }
}

export const dsqlBaseUtilsPlugin = createPluginFactory(DsqlBaseUtilsPlugin);
