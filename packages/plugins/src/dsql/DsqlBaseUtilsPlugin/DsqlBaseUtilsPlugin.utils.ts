import type { TransformerOptions } from "@gqlbase/core";
import { FieldNode, ObjectNode } from "@gqlbase/core/definition";
import { isInDataSourceType } from "@gqlbase/core/plugins";

/** The data source type dsqlbase handles: `transform.dataSources: { db: { type: "dsqlbase" } }`. */
export const DSQLBASE_DATA_SOURCE_TYPE = "dsqlbase";

/**
 * Whether a type is a dsqlbase table: a stored model in a data source of type `"dsqlbase"`, or any stored model when no
 * data source is declared. Reads `@dataSource`, so call it before `cleanup`.
 */
export const isDsqlBaseTable = (
  node: ObjectNode,
  options: Readonly<Pick<TransformerOptions, "dataSources">>
): boolean => {
  return isInDataSourceType(node, options, DSQLBASE_DATA_SOURCE_TYPE);
};

export const DsqlBaseDirective = {
  INDEX: "index",
  UNIQUE: "unique",
} as const;

export const DSQL_INDEX_COLUMN = "DsqlIndexColumn";
export const DSQL_NULLS_ORDER = "DsqlNullsOrder";

export interface DsqlIndexColumn {
  field: string;
  nulls?: "FIRST" | "LAST";
}

export interface DsqlIndex {
  name: string;
  columns: DsqlIndexColumn[];
  unique?: boolean;
  include?: string[];
  distinctNulls?: boolean;
}

/**
 * The `@index` directives of a type, in declaration order. Read them before `cleanup`.
 */
export const getIndexes = (node: ObjectNode): DsqlIndex[] => {
  return (node.directives ?? [])
    .filter((directive) => directive.name === DsqlBaseDirective.INDEX)
    .map((directive) => directive.getArgumentsJSON() as unknown as DsqlIndex);
};

/**
 * The composite unique constraints of a type, `@unique(fields: [...])` on the type, as lists of field names.
 */
export const getUniqueConstraints = (node: ObjectNode): string[][] => {
  return (node.directives ?? [])
    .filter((directive) => directive.name === DsqlBaseDirective.UNIQUE)
    .map((directive) => (directive.getArgumentsJSON() as { fields?: string[] }).fields ?? []);
};

/**
 * Whether a field is marked `@unique`: its column is `.unique()`.
 */
export const isUnique = (field: FieldNode): boolean => {
  return field.hasDirective(DsqlBaseDirective.UNIQUE);
};
