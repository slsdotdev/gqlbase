# Scalars

_Audience: people using the built-in scalars or adding their own._

## Built-in scalars

`ScalarsPlugin` (`packages/core/src/plugins/ScalarsPlugin/ScalarsPlugin.ts`, a core plugin) declares these scalars. Each carries `@specifiedBy` and a type hint. The per-generator mappings live in each generator's utils file (paths in [the last section](#adding-a-built-in-scalar-contributors)).

| Scalar | Type hint | TS | Zod | dsqlbase column | Drizzle column | AppSync |
| --- | --- | --- | --- | --- | --- | --- |
| `DateTime` | string | `string` | `z.iso.datetime()` | `timestamp(…, { mode: "iso" })` | `timestamp` | `AWSDateTime` |
| `Date` | string | `string` | `z.iso.date()` | `date(…, { mode: "iso" })` | `date` | `AWSDate` |
| `Time` | string | `string` | `z.iso.time()` | `time(…, { mode: "iso" })` | `time` | `AWSTime` |
| `Timestamp` | number | `number` | `z.number()` | `timestamp` | `integer` | `AWSTimestamp` |
| `BigInt` | bigint | `number` | `z.number().int()` | `bigintNumber` (local, see below) | `bigint(…, { mode: "number" })` | `Long` |
| `UUID` | id | `string` | `z.uuid()` | `uuid` | `uuid` | `ID` |
| `URL` | string | `string` | `z.url()` | `text` | `text` | `AWSURL` |
| `EmailAddress` | string | `string` | `z.email()` | `text` | `text` | `AWSEmail` |
| `PhoneNumber` | string | `string` | `z.e164()` | `text` | `text` | `AWSPhone` |
| `IPAddress` | string | `string` | `z.ip()` | `text` | `text` | `AWSIPAddress` |
| `JSON` | object | `Record<string, unknown>` | `z.record(z.string(), z.unknown())` | `json` | `json` | `AWSJSON` |

GraphQL's own scalars map as follows:

| Scalar | TS | Zod | dsqlbase column | Drizzle column |
| --- | --- | --- | --- | --- |
| `ID` | `string` | `z.string()` | `uuid` | `uuid` |
| `String` | `string` | `z.string()` | `text` | `text` |
| `Int` | `number` | `z.int()` | `int` (int4) | `integer` |
| `Float` | `number` | `z.number()` | `real` | `doublePrecision` |
| `Boolean` | `boolean` | `z.boolean()` | `bool` | `boolean` |

### `BigInt`

`BigInt` is stored in a 64-bit `bigint` column but typed as a JS `number` everywhere, so values are limited to `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991). That covers money in minor units. A JS `bigint` is not used because the Lambda runtime serializes resolver results with `JSON.stringify`, which throws on one.

- **Zod** uses `z.number().int()`, which accepts only safe integers.
- **dsqlbase:** its own `bigint()` column decodes to a JS `bigint`. So the generated `dsqlbase/schema.ts` declares a local `bigintNumber` builder when a column needs it. The builder is a `bigint` column that encodes with `toString()` and decodes with `Number()`. See [dsqlbase](./dsqlbase.md#bigint-columns).
- **AppSync:** `BigInt` becomes `Long` in the AppSync schema.

There is no decimal scalar built in. Declare one with a hint (see [Adding a custom scalar](#adding-a-custom-scalar)).

## Type hints

A type hint tells every generator what kind of value a scalar carries. It is declared with the internal directive `@gqlbase_typehint` (from `InternalUtilsPlugin`, which is always registered) and removed from the output schema.

```graphql
scalar Decimal @gqlbase_typehint(type: string)
```

The argument is declared `type: TypeHint!`, so the value is a bare **enum literal** (`string`, not `"string"`). The allowed values are `id`, `string`, `number`, `bigint`, `boolean`, `object` and `unknown` (`TypeHintValue` in `packages/core/src/plugins/InternalUtilsPlugin/InternalUtilsPlugin.utils.ts`). A quoted string or any other value fails the transform with an error naming the scalar. A scalar without a hint is `unknown`.

| Hint | TS | Zod | Filter input | dsqlbase column | Drizzle column | AppSync |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `string` | `z.string()` | ID-like | `uuid` | `uuid` | `ID` |
| `string` | `string` | `z.string()` | string-like | `text` | `text` | `String` |
| `number` | `number` | `z.number()` | number-like | `real` | `doublePrecision` | `Float` |
| `bigint` | `number` | `z.number().int()` | number-like | `bigintNumber` (local) | `bigint(…, { mode: "number" })` | `Long` |
| `boolean` | `boolean` | `z.boolean()` | boolean-like | `bool` | `boolean` | `Boolean` |
| `object` | `Record<string, unknown>` | `z.record(z.string(), z.unknown())` | boolean-like | `json` | `jsonb` | `AWSJSON` |
| `unknown` | `unknown` (warning) | `z.unknown()` | boolean-like (warning) | `text` | `text` | none: the transform throws |

Operator sets are listed in [Models](./models.md#operator-sets).

## Adding a custom scalar

Declare it in your SDL with a hint:

```graphql
scalar Decimal @gqlbase_typehint(type: string)
```

With the hint alone, every generator works through its hint fallback (the table in [Type hints](#type-hints)). Each generator also has its own override, because what a scalar means to AppSync or to a database is that generator's concern, not the schema's:

| Generator | How to override | Required? |
| --- | --- | --- |
| AppSync schema | `appsyncPreset({ scalarMappings: { Decimal: "String" } })` | Only when the hint is `unknown` or missing; the transform throws otherwise. |
| dsqlbase | `dsqlbase({ scalarMap: { Decimal: { type: "string", dataType: "numeric" } } })` ([options](./dsqlbase.md#options)) | No |
| Drizzle | `drizzleSchemaGeneratorPlugin({ scalarMap: { Decimal: "numeric" } })` or `{ type, config }` | No |
| Zod | none. Only the hint is used, so no format validation. Use `@constraint(pattern:)` on fields. | — |
| TS | none. Only the hint is used. | — |

There is no single place to declare everything about a scalar once.

## Adding a built-in scalar (contributors)

A new scalar in `ScalarsPlugin` must be added to:
- `BaseScalar` in `ScalarsPlugin.utils.ts`;
- every map typed `Record<BaseScalarName, …>`. TypeScript enforces this:
  - `packages/plugins/src/appsync/AppSyncUtilsPlugin/AppSyncUtilsPlugin.utils.ts` (`BaseScalarMappings`)
  - `packages/plugins/src/zod/ZodSchemaGeneratorPlugin/ZodSchemaGeneratorPlugin.utils.ts` (`CUSTOM_SCALAR_ZOD_MAP`)
  - `packages/plugins/src/dsql/DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.utils.ts` (`SCALAR_TYPE_MAP`)
  - `packages/plugins/src/drizzle/DrizzleSchemaGeneratorPlugin/DrizzleSchemaGeneratorPlugin.utils.ts` (`PG_BASE_SCALAR_MAP`)

A new *hint* value touches even more places:
- `TypeHintValue`;
- `TypesGeneratorBase._createTypeNameIdentifier`;
- `ModelPlugin._createScalarFilterInput`;
- the Zod scalar switch;
- `TYPE_HINT_TYPE_MAP` (dsqlbase) and `TYPE_HINT_DRIZZLE_MAP` (Drizzle).

## Internal definitions

`@gqlbase_internal` marks a definition (type, field, enum, …) as internal to gqlbase. Plugins use it for helper definitions, such as the `ModelOperation` and `TypeHint` enums.

- **What reads the marker:** the code generators skip internal definitions (TS types, Zod, dsqlbase, Drizzle, the AppSync schema and resolver types).
- **What removes internal definitions:** the plugin that adds one should remove it in `after()`. Internal definitions never reach the client schema, so `SchemaGeneratorPlugin` removes any that are left before it prints the schema.

This is a plugin-author tool, not something to put in application schemas.

## Related

- [Models](./models.md) — filter operator sets
- [AppSync](./appsync.md), [Zod](./zod.md), [dsqlbase](./dsqlbase.md), [Drizzle](./drizzle.md)
- [Known gaps](../internals/known-gaps.md)
