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

There is no 64-bit integer scalar and no decimal scalar built in.

## Type hints

A type hint tells every generator what kind of value a scalar carries. It is declared with the internal directive `@gqlbase_typehint` (from `InternalUtilsPlugin`, which is always registered) and removed from the output schema.

```graphql
scalar Decimal @gqlbase_typehint(type: string)
```

The value must be written as a bare **enum literal** (`string`, not `"string"`). A quoted string is ignored and the scalar is treated as `unknown`. The allowed values are `id`, `string`, `number`, `boolean`, `object` and `unknown` (`TypeHintValue` in `packages/core/src/plugins/InternalUtilsPlugin/InternalUtilsPlugin.utils.ts`). A scalar without a hint is `unknown`.

> The directive's argument is declared as `String!` while every reader expects an enum literal, and the `getTypeHint` docstring says the default is `"string"` when it is actually `"unknown"`. See [Known gaps](../internals/known-gaps.md).

| Hint | TS | Zod | Filter input | dsqlbase column | Drizzle column |
| --- | --- | --- | --- | --- | --- |
| `id` | `string` | `z.string()` | ID-like | `uuid` | `uuid` |
| `string` | `string` | `z.string()` | string-like | `text` | `text` |
| `number` | `number` | `z.number()` | number-like | `real` | `doublePrecision` |
| `boolean` | `boolean` | `z.boolean()` | boolean-like | `bool` | `boolean` |
| `object` | `Record<string, unknown>` | `z.record(z.string(), z.unknown())` | boolean-like | `json` | `jsonb` |
| `unknown` | `unknown` (warning) | `z.unknown()` | boolean-like (warning) | `text` | `text` |

Operator sets are listed in [Models](./models.md#operator-sets).

## Adding a custom scalar

Declare it in your SDL with a hint:

```graphql
scalar Decimal @gqlbase_typehint(type: string)
```

With the hint alone, TS types, filter inputs, Zod, dsqlbase and Drizzle all work through their hint fallbacks. To go further, configure each generator separately:

| Generator | How to override | Required? |
| --- | --- | --- |
| AppSync schema | `appsyncPreset({ scalarMappings: { Decimal: "String" } })` | **Yes.** An unmapped custom scalar throws. |
| dsqlbase | `scalarMap: { Decimal: { type: "string", dataType: "numeric" } }` on the plugin options | No, but the `dsqlbase()` helper passes no options (see [dsqlbase](./dsqlbase.md#options)) |
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
