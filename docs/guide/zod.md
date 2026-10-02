# Zod

_Audience: people validating data with Zod schemas generated from the GraphQL schema._

```js
import { zodSchemaGeneratorPlugin } from "@gqlbase/plugins/zod";

plugins: [zodSchemaGeneratorPlugin({ generateArgumentSchemas: true })];
```

The plugin is `ZodSchemaGeneratorPlugin` (`packages/plugins/src/zod/ZodSchemaGeneratorPlugin/ZodSchemaGeneratorPlugin.ts`). It is not part of any preset. It writes `zod/schema.validators.ts`, which imports `* as z from "zod/v4"`.

| Option | Default | Description |
| --- | --- | --- |
| `fileName` | `"schema.validators.ts"` | File name inside `zod/`. |
| `emitOutput` | `false` | Also return the file content from `transform()` as `output.zodSchemas`. |
| `generateArgumentSchemas` | `false` | Also emit schemas for every input type used as a field argument, and their dependencies (filter and `orderBy` inputs, including those on `@hasMany` fields of non-model types, mutation inputs, custom inputs). |
| `scalars` | `{}` | Zod code per scalar name, used instead of the built-in mapping or the type hint. See [Scalars](#scalars). |

## What is generated

| Definition | Schema |
| --- | --- |
| enum `E` | `ESchema = z.enum([...])` |
| object or interface `T` | `TSchema = z.object({...})` |
| union `U` | `USchema = z.union([...])` |
| `@model` type `M` | `MSchema`, plus `CreateMInputSchema` and `UpdateMInputSchema` |
| input type `I` | `ISchema`, only with `generateArgumentSchemas` |

- Root types, scalars, directive definitions and `@gqlbase_internal` definitions produce nothing.
- Definitions that no field reaches from the root types, including `@serverOnly` and `@writeOnly` fields, produce nothing (`collectReachableDefinitions`).
- Schemas are emitted in dependency order, and cycles are wrapped in `z.lazy(...)`.
- Self-referencing inputs (for example `and: [XFilterInput]`) are built as a base object plus `.extend(...)`.

### Object schemas (`<Type>Schema`)

- **Excluded fields:** `@writeOnly` fields and relation fields.
- **Kept fields:** everything else, including `@serverOnly` and `@clientOnly` fields.
- **Nullability:** a nullable field becomes `.nullable().optional()`; nullable list items become `.nullable()`. `@semanticNonNull` counts as non-null.

### Model create/update schemas

`Create<Model>InputSchema` and `Update<Model>InputSchema` describe the **stored record** for a write, so a `@clientOnly` model gets neither. They are not the GraphQL `Create<Model>Input`. The field rules come from `shouldIncludeInZodCreate` / `shouldIncludeInZodUpdate` in `ZodSchemaGeneratorPlugin.utils.ts`:

- **Included:**
  - `@readOnly`, `@serverOnly` and `@writeOnly` fields;
  - relation key fields such as `authorId`.
- **Excluded:**
  - relation fields;
  - `@clientOnly` fields;
  - fields whose type is another `@model`;
  - the operation-specific fields (`@filterOnly`, `@updateOnly` from create, `@createOnly` from update, unless combined).
- **Create schema:**
  - `id` is `.optional()`;
  - other fields keep their nullability.
- **Update schema:**
  - `id` is required;
  - non-null fields become `.optional()`;
  - nullable fields become `.nullable().optional()`.
- **Non-model object fields** reference the object's output `<Type>Schema`.

The full comparison with the GraphQL inputs is in [Field visibility](./field-visibility.md).

## Scalars

| Scalar | Zod |
| --- | --- |
| `ID`, `String` | `z.string()` |
| `Int` | `z.int()` |
| `Float` | `z.number()` |
| `Boolean` | `z.boolean()` |
| built-in gqlbase scalars | see [Scalars](./scalars.md#built-in-scalars) (`z.iso.datetime()`, `z.uuid()`, `z.email()`, …) |
| custom scalars | by type hint: `z.string()`, `z.number()`, `z.boolean()`, `z.record(z.string(), z.unknown())`, or `z.unknown()` |

The `scalars` option replaces the expression for a named scalar, whether it is custom, built into gqlbase or a GraphQL scalar. The value is Zod code on `z`, inserted as written, and is used wherever the scalar appears: fields, list items and arguments. `@constraint` checks are still appended to it. Names that are not scalars are ignored.

```js
zodSchemaGeneratorPlugin({
  scalars: {
    Currency: 'z.string().regex(/^[A-Z]{3}$/, "Expected an ISO 4217 code")',
  },
});
```

## Constraints

`@constraint(min, max, pattern)` appends `.min()`, `.max()` and `.regex()` to the field's leaf schema (see [Field visibility](./field-visibility.md#constraint)).

```graphql
type User @model {
  id: ID!
  name: String! @constraint(min: 3, max: 50)
}
```

```ts
export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(3).max(50),
});
```

## Related

- [Field visibility](./field-visibility.md)
- [Scalars](./scalars.md)
- [Models](./models.md)
- [Known gaps](../internals/known-gaps.md)
