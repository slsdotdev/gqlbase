import { BaseScalar, type BaseScalarName } from "@gqlbase/core/plugins";

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

  /**
   * Zod code per scalar name, used instead of the built-in mapping or the type hint. The code is an expression on `z`.
   * @example { Currency: 'z.string().regex(/^[A-Z]{3}$/)' }
   * @default {}
   */
  scalars?: Record<string, string>;
}

export const DEFAULT_OPTIONS: Required<ZodSchemaGeneratorPluginOptions> = {
  fileName: "schema.validators.ts",
  emitOutput: false,
  generateArgumentSchemas: false,
  scalars: {},
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
  [BaseScalar.SAFE_INT]: "z.number().int()",
  [BaseScalar.UUID]: "z.uuid()",
  // A wrapped `guid:` id or a raw uuid; the encoding is dsqlbase's.
  [BaseScalar.GUID]: "z.string()",
  [BaseScalar.URL]: "z.url()",
  [BaseScalar.EMAIL_ADDRESS]: "z.email()",
  [BaseScalar.PHONE_NUMBER]: "z.e164()",
  [BaseScalar.IP_ADDRESS]: "z.ip()",
  [BaseScalar.JSON]: "z.record(z.string(), z.unknown())",
};
