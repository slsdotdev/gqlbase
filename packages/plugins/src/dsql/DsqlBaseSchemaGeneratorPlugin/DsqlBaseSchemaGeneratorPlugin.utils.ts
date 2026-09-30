import { BuildInScalar, isBuildInScalar } from "@gqlbase/shared/definition";
import { BaseScalarName, isBaseScalar, TypeHintValueType } from "@gqlbase/core/plugins";

export interface ScalarConfig {
  type: string;
  dataType: string;
  options?: Record<string, unknown>;
}

export interface DsqlBaseSchemaGeneratorPluginOptions {
  emitOutput?: boolean;
  scalarMap?: Record<string, ScalarConfig>;
}

export const DEFAULT_OPTIONS: Required<DsqlBaseSchemaGeneratorPluginOptions> = {
  emitOutput: false,
  scalarMap: {},
};

export const mergeOptions = (options: DsqlBaseSchemaGeneratorPluginOptions = {}) => {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    scalarMap: { ...DEFAULT_OPTIONS.scalarMap, ...options.scalarMap },
  };
};

export const SCALAR_TYPE_MAP: Record<BuildInScalar | BaseScalarName, ScalarConfig> = {
  ID: { type: "string", dataType: "uuid" },
  String: { type: "string", dataType: "text" },
  Int: { type: "number", dataType: "int" },
  Float: { type: "number", dataType: "real" },
  Boolean: { type: "boolean", dataType: "bool" },
  UUID: { type: "string", dataType: "uuid" },
  DateTime: { type: "string", dataType: "timestamp", options: { mode: "iso" } },
  Date: { type: "string", dataType: "date", options: { mode: "iso" } },
  Time: { type: "string", dataType: "time", options: { mode: "iso" } },
  Timestamp: { type: "string", dataType: "timestamp" },
  URL: { type: "string", dataType: "text" },
  EmailAddress: { type: "string", dataType: "text" },
  PhoneNumber: { type: "string", dataType: "text" },
  IPAddress: { type: "string", dataType: "text" },
  JSON: { type: "string", dataType: "json" },
};

export const TYPE_HINT_TYPE_MAP: Record<TypeHintValueType, ScalarConfig> = {
  id: { type: "string", dataType: "uuid" },
  string: { type: "string", dataType: "text" },
  number: { type: "number", dataType: "real" },
  boolean: { type: "boolean", dataType: "bool" },
  object: { type: "string", dataType: "json" },
  unknown: { type: "string", dataType: "text" },
};

export const resolveScalarDataType = (
  typeName: string,
  config?: Record<string, ScalarConfig>
): ScalarConfig | null => {
  if (config?.[typeName]) {
    return config[typeName];
  }

  if (isBuildInScalar(typeName) || isBaseScalar(typeName)) {
    return SCALAR_TYPE_MAP[typeName];
  }

  return null;
};

export function resolveTypeHintDataType(hintValue: TypeHintValueType): ScalarConfig {
  return TYPE_HINT_TYPE_MAP[hintValue];
}
