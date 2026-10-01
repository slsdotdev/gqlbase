import ts from "typescript";
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
  SafeInt: { type: "number", dataType: "safeint" },
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
  bigint: { type: "number", dataType: "safeint" },
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

/**
 * Column builders the generated schema declares itself, because `dsqlbase/schema` has none with the right typing. `safeint` is a `bigint` column that decodes to `number` (dsqlbase's `bigint` decodes to a JS `bigint`, which `JSON.stringify` rejects).
 */
export const LocalColumnBuilder = {
  SAFEINT: "safeint",
} as const;

export type LocalColumnBuilderName = (typeof LocalColumnBuilder)[keyof typeof LocalColumnBuilder];

export const isLocalColumnBuilder = (dataType: string): dataType is LocalColumnBuilderName => {
  return Object.values(LocalColumnBuilder).includes(dataType as LocalColumnBuilderName);
};

/**
 * `const safeint = <const TName extends string>(name: TName) => new ColumnDefinition<TName, ColumnConfig<number, string>>(name, { dataType: "bigint", codec: { encode: (value) => value.toString(), decode: (value) => Number(value) } });`
 */
const createSafeIntBuilder = (): ts.VariableStatement => {
  const valueParam = () => ts.factory.createParameterDeclaration(undefined, undefined, "value");

  const codec = ts.factory.createObjectLiteralExpression([
    ts.factory.createPropertyAssignment(
      "encode",
      ts.factory.createArrowFunction(
        undefined,
        undefined,
        [valueParam()],
        undefined,
        undefined,
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier("value"),
            "toString"
          ),
          undefined,
          []
        )
      )
    ),
    ts.factory.createPropertyAssignment(
      "decode",
      ts.factory.createArrowFunction(
        undefined,
        undefined,
        [valueParam()],
        undefined,
        undefined,
        ts.factory.createCallExpression(ts.factory.createIdentifier("Number"), undefined, [
          ts.factory.createIdentifier("value"),
        ])
      )
    ),
  ]);

  const definition = ts.factory.createNewExpression(
    ts.factory.createIdentifier("ColumnDefinition"),
    [
      ts.factory.createTypeReferenceNode("TName"),
      ts.factory.createTypeReferenceNode("ColumnConfig", [
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      ]),
    ],
    [
      ts.factory.createIdentifier("name"),
      ts.factory.createObjectLiteralExpression(
        [
          ts.factory.createPropertyAssignment("dataType", ts.factory.createStringLiteral("bigint")),
          ts.factory.createPropertyAssignment("codec", codec),
        ],
        true
      ),
    ]
  );

  const builder = ts.factory.createArrowFunction(
    undefined,
    [
      ts.factory.createTypeParameterDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ConstKeyword)],
        "TName",
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
      ),
    ],
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "name",
        undefined,
        ts.factory.createTypeReferenceNode("TName")
      ),
    ],
    undefined,
    undefined,
    definition
  );

  return ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          LocalColumnBuilder.SAFEINT,
          undefined,
          undefined,
          builder
        ),
      ],
      ts.NodeFlags.Const
    )
  );
};

const LOCAL_COLUMN_BUILDERS: Record<LocalColumnBuilderName, () => ts.VariableStatement> = {
  [LocalColumnBuilder.SAFEINT]: createSafeIntBuilder,
};

/**
 * The declaration of a local column builder, emitted once in the generated schema.
 */
export const createLocalColumnBuilder = (name: LocalColumnBuilderName): ts.VariableStatement =>
  LOCAL_COLUMN_BUILDERS[name]();

/**
 * `import { ColumnDefinition, type ColumnConfig } from "@dsqlbase/core";` Local builders construct a `ColumnDefinition`, which only `@dsqlbase/core` exports.
 */
export const createLocalColumnBuilderImport = (): ts.ImportDeclaration =>
  ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      undefined,
      undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(
          false,
          undefined,
          ts.factory.createIdentifier("ColumnDefinition")
        ),
        ts.factory.createImportSpecifier(
          true,
          undefined,
          ts.factory.createIdentifier("ColumnConfig")
        ),
      ])
    ),
    ts.factory.createStringLiteral("@dsqlbase/core")
  );
