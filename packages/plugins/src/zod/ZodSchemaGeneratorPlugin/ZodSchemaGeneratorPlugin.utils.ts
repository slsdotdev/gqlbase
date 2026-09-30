import { FieldNode } from "@gqlbase/core/definition";
import {
  BaseScalar,
  type BaseScalarName,
  isClientOnly,
  isCreateOnly,
  isFilterOnly,
  isUpdateOnly,
  isRelationField,
} from "@gqlbase/core/plugins";

export interface ZodSchemaGeneratorPluginOptions {
  /**
   * The output file name for the generated schemas.
   * @default "schema.validators.ts"
   */
  fileName?: string;

  /**
   * Whether to include the generated schemas in the output object.
   * @default false
   */
  emitOutput?: boolean;

  /**
   * When true, walk every field argument in the schema and emit zod schemas for the
   * argument types and their transitive dependencies (filter inputs, custom inputs, etc.).
   * Schemas already emitted (model-derived create/update, plain object schemas) are not
   * overwritten.
   * @default false
   */
  generateArgumentSchemas?: boolean;
}

export const DEFAULT_OPTIONS: Required<ZodSchemaGeneratorPluginOptions> = {
  fileName: "schema.validators.ts",
  emitOutput: false,
  generateArgumentSchemas: false,
} as const;

export const mergeOptions = (
  options?: ZodSchemaGeneratorPluginOptions
): Required<ZodSchemaGeneratorPluginOptions> => {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
};

export const CUSTOM_SCALAR_ZOD_MAP: Record<BaseScalarName, string> = {
  [BaseScalar.DATE_TIME]: "z.iso.datetime()",
  [BaseScalar.DATE]: "z.iso.date()",
  [BaseScalar.TIME]: "z.iso.time()",
  [BaseScalar.TIMESTAMP]: "z.number()",
  [BaseScalar.UUID]: "z.uuid()",
  [BaseScalar.URL]: "z.url()",
  [BaseScalar.EMAIL_ADDRESS]: "z.email()",
  [BaseScalar.PHONE_NUMBER]: "z.e164()",
  [BaseScalar.IP_ADDRESS]: "z.ip()",
  [BaseScalar.JSON]: "z.record(z.string(), z.unknown())",
};

/**
 * Persistence-row inclusion rule for the model-derived create schema.
 * Includes @serverOnly and @readOnly fields (they live on the row).
 * Excludes relations, @clientOnly, @filterOnly, and @updateOnly-without-createOnly.
 */
export const shouldIncludeInZodCreate = (field: FieldNode): boolean => {
  if (isRelationField(field)) return false;
  if (isClientOnly(field)) return false;
  if (isFilterOnly(field) && !isCreateOnly(field)) return false;
  if (isUpdateOnly(field) && !isCreateOnly(field)) return false;
  return true;
};

/**
 * Persistence-row inclusion rule for the model-derived update schema.
 * Same as create but with create/update swapped.
 */
export const shouldIncludeInZodUpdate = (field: FieldNode): boolean => {
  if (isRelationField(field)) return false;
  if (isClientOnly(field)) return false;
  if (isFilterOnly(field) && !isUpdateOnly(field)) return false;
  if (isCreateOnly(field) && !isUpdateOnly(field)) return false;
  return true;
};
