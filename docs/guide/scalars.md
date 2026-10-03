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
| `SafeInt` | number | `number` | `z.number().int()` | `safeint` (local, see below) | `bigint(…, { mode: "number" })` | `Long` |
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

### `SafeInt`

`SafeInt` is an integer a JS `number` holds exactly: between `Number.MIN_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER` (±9,007,199,254,740,991), as defined by [`Number.isSafeInteger`](https://tc39.es/ecma262/#sec-number.issafeinteger). It is typed `number` everywhere and stored in a 64-bit column, so it is not capped at the `Int` (int4) range. That covers money in minor units.

The name states the limit. A larger value does not fail on the way in: JSON numbers are doubles, so AppSync and the Lambda runtime round it to the nearest double before the resolver sees it (sent `9007199254740993`, received `9007199254740992`). The rounded value is outside the safe range, so the generated Zod schema rejects it; a resolver that skips validation would store the rounded value. There is no 64-bit scalar typed as a JS `bigint`: the Lambda runtime serializes results with `JSON.stringify`, which throws on one.

- **Zod** uses `z.number().int()`, which in Zod 4 accepts only safe integers.
- **dsqlbase:** its own `bigint()` column decodes to a JS `bigint`. So the generated `dsqlbase/schema.ts` declares a local `safeint` builder when a column needs it. The builder is a `bigint` column that encodes with `toString()` and decodes with `Number()`. See [dsqlbase](./dsqlbase.md#safeint-columns).
- **AppSync:** `SafeInt` becomes `Long` in the AppSync schema.

There is no type hint for this: `SafeInt` carries the `number` hint, and each generator maps it by name. To give a custom scalar the same treatment, use `SafeInt` instead, or set each generator's override (`scalarMappings: { Cents: "Long" }`, `scalarMap: { Cents: { type: "number", dataType: "safeint" } }`, `scalars: { Cents: "z.number().int()" }`).

There is no decimal scalar built in. Declare one with a hint (see [Adding a custom scalar](#adding-a-custom-scalar)).

## Type hints

A type hint tells every generator what kind of value a scalar carries. It is declared with the internal directive `@gqlbase_typehint` (from `InternalUtilsPlugin`, which is always registered) and removed from the output schema.

```graphql
scalar Decimal @gqlbase_typehint(type: string)
```

The argument is declared `type: TypeHint!`, so the value is a bare **enum literal** (`string`, not `"string"`). The allowed values are `id`, `string`, `number`, `boolean`, `object` and `unknown` (`TypeHintValue` in `packages/core/src/plugins/InternalUtilsPlugin/InternalUtilsPlugin.utils.ts`). A quoted string or any other value fails the transform with an error naming the scalar. A scalar without a hint is `unknown`.

A scalar that arrives in a different form than it is returned takes an `input` hint as well, used for arguments and input fields: `scalar AWSJSON @gqlbase_typehint(type: object, input: string)` is a JSON string on input and an object on output. Without it, `input` is `type`. The schema types expose both sides in `Scalars` (see [Configuration → Schema types](./configuration.md#schema-types)).

| Hint | TS | Zod | Filter input | dsqlbase column | Drizzle column | AppSync |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `string` | `z.string()` | ID-like | `uuid` | `uuid` | `ID` |
| `string` | `string` | `z.string()` | string-like | `text` | `text` | `String` |
| `number` | `number` | `z.number()` | number-like | `real` | `doublePrecision` | `Float` |
| `boolean` | `boolean` | `z.boolean()` | boolean-like | `bool` | `boolean` | `Boolean` |
| `object` | `Record<string, unknown>` | `z.record(z.string(), z.unknown())` | boolean-like | `json` | `jsonb` | `AWSJSON` |
| `unknown` | `unknown` (warning) | `z.unknown()` | boolean-like (warning) | `text` | `text` | none: the transform throws |

The built-in date scalars (`Date`, `DateTime`, `Time`, `Timestamp`) are filtered as dates whatever their hint: ranges and `between`, no substring operators. Operator sets are listed in [Models](./models.md#operator-sets).

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
| Zod | `zodSchemaGeneratorPlugin({ scalars: { Decimal: "z.string().regex(/^-?\\d+(\\.\\d+)?$/)" } })` ([Zod](./zod.md#scalars)) | No |
| TS | none. Only the hint is used. | — |

There is deliberately no single place to declare everything about a scalar: the schema declares what the scalar *is* (its hint), and each generator decides how to represent it.

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
- `FilterPlugin._getScalarFilterKind`;
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
