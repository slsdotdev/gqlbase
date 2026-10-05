# Known gaps

_Audience: contributors and agents. Read this before designing a feature._

These are verified defects and inconsistencies in the current code. **Fix them; do not design around them.** If a feature touches one, the fix is a prerequisite story in that feature's proposal ([Conventions → Design workflow](./conventions.md#design-workflow)). When a gap is fixed, delete its entry in the same PR.

## Schema transformation

### 5. Lists of objects cannot be filtered

`FilterPlugin._getFieldFilterInputName` (`packages/core/src/plugins/FilterPlugin/FilterPlugin.ts`) returns no filter for a list of objects, interfaces or unions (`tiers: [PricingModel!]`), so the field is left out of `<Type>FilterInput`. Object fields that are not lists are filtered through `<Type>FieldFilterInput`.

## Code generation

### 14. Drizzle emits `json`, not `jsonb`

`DrizzleSchemaGeneratorPlugin` (`packages/plugins/src/drizzle/DrizzleSchemaGeneratorPlugin/DrizzleSchemaGeneratorPlugin.ts`) emits `json("<col>").$type<T>()` for non-model object fields. Its test is titled "generates jsonb()…" but asserts `json(`. The typehint map in `DrizzleSchemaGeneratorPlugin.utils.ts` maps `object` to `"jsonb"`, so the two paths disagree.

The same plugin also ignores its `dialect` option, and it uses a union's name as a table variable when a relation targets a union.

### 19. Drizzle imports column types the schema types do not export

`DrizzleSchemaGeneratorPlugin` imports the type of every object column from `../schema.types.js`. A column typed with an object that is not in the output schema (a `@serverOnly` object, or one only `@serverOnly` fields use) produces an import of a name that does not exist. The dsqlbase generator declares such types locally instead (`TypesGeneratorBase._referenceType`). Drizzle is frozen, so this stays until it is revived or removed.

### 20. dsqlbase types `Timestamp` and some list columns differently from the rest

`SCALAR_TYPE_MAP` (`packages/plugins/src/dsql/DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.utils.ts`) maps `Timestamp` to `timestamp("<col>")`, whose default mode reads a JS `Date`. Everywhere else `Timestamp` is a `number` of seconds: its type hint, `Scalars`, Zod and `AWSTimestamp`. A resolver that returns the row hands AppSync a `Date`.

A list column takes its element type from the same map's `type`, so `[Timestamp!]` is `array().$type<string[]>()` and `[JSON!]` is `string[]`, where the schema types say `number[]` and `Record<string, unknown>[]`.

The fix changes the `Timestamp` column type (to a `bigint` of seconds), which existing tables have to migrate.

## Related

- [Architecture](./architecture.md)
- [Testing](./testing.md)
- [Conventions → Design workflow](./conventions.md#design-workflow)
