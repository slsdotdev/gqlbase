# Known gaps

_Audience: contributors and agents. Read this before designing a feature._

These are verified defects and inconsistencies in the current code. **Fix them; do not design around them.** If a feature touches one, the fix is a prerequisite story in that feature's proposal ([Conventions → Design workflow](./conventions.md#design-workflow)). When a gap is fixed, delete its entry in the same PR.

## Schema transformation

### 5. Lists of objects cannot be filtered

`FilterPlugin._getFieldFilterInputName` (`packages/core/src/plugins/FilterPlugin/FilterPlugin.ts`) returns no filter for a list of objects, interfaces or unions (`tiers: [PricingModel!]`), so the field is left out of `<Type>FilterInput`. Object fields that are not lists are filtered through `<Type>FieldFilterInput`.

## Code generation

### 20. dsqlbase types `Timestamp` and some list columns differently from the rest

`SCALAR_TYPE_MAP` (`packages/plugins/src/dsql/DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.utils.ts`) maps `Timestamp` to `timestamp("<col>")`, whose default mode reads a JS `Date`. Everywhere else `Timestamp` is a `number` of seconds: its type hint, `Scalars`, Zod and `AWSTimestamp`. A resolver that returns the row hands AppSync a `Date`.

A list column takes its element type from the same map's `type`, so `[Timestamp!]` is `array().$type<string[]>()` and `[JSON!]` is `string[]`, where the schema types say `number[]` and `Record<string, unknown>[]`.

The fix changes the `Timestamp` column type (to a `bigint` of seconds), which existing tables have to migrate.

### 22. Zod mutation-input schemas read the model, not the input

`ZodSchemaGeneratorPlugin` (`packages/plugins/src/zod/ZodSchemaGeneratorPlugin/ZodSchemaGeneratorPlugin.ts`) builds a `Create<Model>Input`/`Update<Model>Input` field from the model field when the two match by name and type (`_getMirroredField`). It does this because the input does not carry two things the schema needs. `ModelPlugin` creates input fields without the model's `@constraint`, and SDL cannot say that a field may be left out but not set to `null` (update fields, and create fields the server fills).

At generate time a hand-written input that replaces a model input cannot be told apart from a generated one. So a declared field that mirrors a model field takes the model's rules over its own SDL: `email: String` declared over a non-null model `email` rejects `null`, and the model's `@constraint` applies, while a `@constraint` on the declared field is ignored.

The fix moves that knowledge onto the input. `ModelPlugin` copies `@constraint` to the fields it creates and marks the "omittable, not null" ones with an internal directive, stripped in `cleanup` like `@gqlbase_tuple`. The Zod plugin then reads every input from the input alone.

## Related

- [Architecture](./architecture.md)
- [Testing](./testing.md)
- [Conventions → Design workflow](./conventions.md#design-workflow)
