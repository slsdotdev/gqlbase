import { BuildInScalar, isBuildInScalar } from "@gqlbase/shared/definition";
import { snakeCase, pluralize, camelCase } from "@gqlbase/shared/format";
import { BaseScalarName, isBaseScalar, TypeHintValueType } from "@gqlbase/core/plugins";
import { JsonValue } from "@gqlbase/shared/codegen";

export interface ScalarConfig {
  type: string;
  config?: Record<string, JsonValue>;
}

export interface DrizzleSchemaGeneratorPluginOptions {
  dialect?: "postgresql" | "mysql" | "sqlite";
  fileName?: string;
  emitOutput?: boolean;
  scalarMap?: Record<string, string | ScalarConfig>;
}

export const DEFAULT_OPTIONS: Required<Omit<DrizzleSchemaGeneratorPluginOptions, "scalarMap">> & {
  scalarMap: Record<string, string>;
} = {
  dialect: "postgresql",
  fileName: "schema.ts",
  emitOutput: false,
  scalarMap: {},
} as const;

export const mergeOptions = (options: DrizzleSchemaGeneratorPluginOptions = {}) => {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    scalarMap: { ...DEFAULT_OPTIONS.scalarMap, ...options.scalarMap },
  };
};

export const PG_BUILITIN_SCALAR_MAP: Record<BuildInScalar, string> = {
  ID: "uuid",
  String: "text",
  Int: "integer",
  Float: "doublePrecision",
  Boolean: "boolean",
};

/**
 * Maps built-in GraphQL scalars and gqlbase base scalars to Drizzle pg-core column functions.
 * Custom scalars (e.g. Decimal) must be provided via `options.scalarMap`.
 */
export const PG_BASE_SCALAR_MAP: Record<BaseScalarName, string> = {
  UUID: "uuid",
  DateTime: "timestamp",
  Date: "date",
  Time: "time",
  Timestamp: "integer",
  URL: "text",
  EmailAddress: "text",
  PhoneNumber: "text",
  IPAddress: "text",
  JSON: "json",
};

/**
 * Fallback mapping from @gqlbase_typehint values to Drizzle pg-core column functions.
 */
export const TYPE_HINT_DRIZZLE_MAP: Record<TypeHintValueType, string> = {
  id: "uuid",
  string: "text",
  number: "doublePrecision",
  boolean: "boolean",
  object: "jsonb",
  unknown: "text",
};

export function toTableName(typeName: string): string {
  return snakeCase(pluralize(typeName));
}

export function toTableVarName(typeName: string): string {
  return camelCase(pluralize(typeName));
}

export function resolveScalarType(
  typeName: string,
  options: DrizzleSchemaGeneratorPluginOptions
): ScalarConfig | null {
  if (options.scalarMap?.[typeName]) {
    const mapping = options.scalarMap[typeName];

    if (typeof mapping === "string") {
      return { type: mapping };
    } else {
      return mapping;
    }
  }

  if (isBuildInScalar(typeName)) {
    return { type: PG_BUILITIN_SCALAR_MAP[typeName] };
  }

  if (isBaseScalar(typeName)) {
    return { type: PG_BASE_SCALAR_MAP[typeName] };
  }

  return null;
}

export const resolveTypeHintType = (typeHint: TypeHintValueType): ScalarConfig => {
  return { type: TYPE_HINT_DRIZZLE_MAP[typeHint] };
};
