import { FieldNode } from "../../definition/index.js";
import {
  isClientOnly,
  isCreateOnly,
  isFilterOnly,
  isReadOnly,
  isServerOnly,
  isUpdateOnly,
  isWriteOnly,
} from "../UtilitiesPlugin/index.js";
import { isRelationField } from "../RelationsPlugin/RelationsPlugin.utils.js";
import { BaseScalar } from "../ScalarsPlugin/ScalarsPlugin.utils.js";

/**
 * Built-in scalars filtered as dates: ranges, no substring operators.
 */
export const DATE_SCALARS: readonly string[] = [
  BaseScalar.DATE,
  BaseScalar.DATE_TIME,
  BaseScalar.TIME,
  BaseScalar.TIMESTAMP,
];

/**
 * Clients cannot filter on a value they cannot read, so `@writeOnly` fields are left out unless `@filterOnly` asks for them.
 */
export const shouldSkipFieldFromFilterInput = (field: FieldNode): boolean => {
  return (
    isReadOnly(field) ||
    isServerOnly(field) ||
    isClientOnly(field) ||
    isRelationField(field) ||
    ((isCreateOnly(field) || isUpdateOnly(field) || isWriteOnly(field)) && !isFilterOnly(field))
  );
};

/**
 * The filter operator vocabulary, the same for every backend. The names are dsqlbase's, so a filter passes to dsqlbase's `where` unchanged.
 */
export const FilterOperator = {
  EQ: "eq",
  NEQ: "neq",
  LT: "lt",
  LTE: "lte",
  GT: "gt",
  GTE: "gte",
  IN: "in",
  BETWEEN: "between",
  BEGINS_WITH: "beginsWith",
  ENDS_WITH: "endsWith",
  CONTAINS: "contains",
  EXISTS: "exists",
} as const;

export type FilterOperatorName = (typeof FilterOperator)[keyof typeof FilterOperator];

export type FilterKind = "id" | "string" | "number" | "date" | "boolean" | "enum" | "list";

const { EQ, NEQ, LT, LTE, GT, GTE, IN, BETWEEN, BEGINS_WITH, ENDS_WITH, CONTAINS, EXISTS } =
  FilterOperator;

/**
 * The operators each kind of filter input accepts.
 */
export const FilterOperators: Record<FilterKind, readonly FilterOperatorName[]> = {
  id: [EQ, NEQ, IN, EXISTS],
  string: [EQ, NEQ, LT, LTE, GT, GTE, IN, BETWEEN, BEGINS_WITH, ENDS_WITH, CONTAINS, EXISTS],
  number: [EQ, NEQ, LT, LTE, GT, GTE, IN, BETWEEN, EXISTS],
  date: [EQ, NEQ, LT, LTE, GT, GTE, IN, BETWEEN, EXISTS],
  boolean: [EQ, NEQ, EXISTS],
  enum: [EQ, NEQ, IN, EXISTS],
  list: [CONTAINS, EXISTS],
};
