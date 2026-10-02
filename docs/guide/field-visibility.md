# Field visibility

_Audience: people controlling where a field appears — public schema, inputs, filters, generated code, database._

The utility directives are declared by `UtilitiesPlugin` (`packages/core/src/plugins/UtilitiesPlugin/UtilitiesPlugin.ts`; predicates such as `isReadOnly` in `UtilitiesPlugin.utils.ts`), a core plugin. All of them go on `FIELD_DEFINITION`. `@serverOnly` and `@clientOnly` also go on `OBJECT` (see [On an object type](#on-an-object-type)), and `@constraint` also goes on `INPUT_FIELD_DEFINITION` and `ARGUMENT_DEFINITION`.

| Directive | Intent |
| --- | --- |
| `@readOnly` | Output only; never written through the API. |
| `@writeOnly` | Written through the API, never returned. |
| `@serverOnly` | Stored and used by the server; not part of the public API. |
| `@clientOnly` | Returned by the API but computed at runtime; not stored. |
| `@createOnly` | Accepted only when creating. |
| `@updateOnly` | Accepted only when updating. |
| `@filterOnly` | Accepted only in filters. |
| `@constraint(min, max, pattern)` | Validation rule consumed by generators (Zod today). |

## What each generator does

One core rule decides what reaches the client schema: `isPublicSchemaField(field, parent)` (`packages/core/src/plugins/SchemaGeneratorPlugin/SchemaGeneratorPlugin.utils.ts`). A field is public unless it is `@serverOnly`, `@writeOnly` or internal. The public SDL, the TS schema types and the AppSync resolver types all use it. The inputs, Zod and the database describe what is *stored* and apply their own rules. The table was derived from the code:

- **SDL**: `UtilitiesPlugin.cleanup` and `SchemaGeneratorPlugin`.
- **GraphQL inputs**: `ModelPlugin.utils.ts`; filters: `FilterPlugin.utils.ts`.
- **TS**: `ModelTypesGeneratorPlugin`.
- **Zod**: `ZodSchemaGeneratorPlugin` and `ZodSchemaGeneratorPlugin.utils.ts`.
- **DB**: `DsqlBaseSchemaGeneratorPlugin` and `DrizzleSchemaGeneratorPlugin`.

The entries were checked by running the transformer.

✓ = present, — = absent.

| Field marked | Public SDL type | Create input | Update / upsert input | Filter input | TS model type | Zod `<Type>Schema` | Zod `Create`/`Update…InputSchema` | DB column |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| *(nothing)* | ✓ | ✓ | ✓ (nullable) | ✓ | ✓ | ✓ | ✓ / ✓ | ✓ |
| `@readOnly` | ✓ | — | — | — | ✓ | ✓ | ✓ / ✓ | ✓ |
| `@writeOnly` | — | ✓ | ✓ | — ¹ | — | — | ✓ / ✓ | ✓ |
| `@serverOnly` | — | — | — | — | — | ✓ | ✓ / ✓ | ✓ |
| `@clientOnly` | ✓ | — | — | — | ✓ | ✓ | — / — | — |
| `@createOnly` | ✓ | ✓ | — | — ² | ✓ | ✓ | ✓ / — | ✓ |
| `@updateOnly` | ✓ | — | ✓ | — ² | ✓ | ✓ | — / ✓ | ✓ |
| `@filterOnly` | ✓ | — ² | — ² | ✓ | ✓ | ✓ | — / — ² | ✓ |
| relation field (`@hasOne`…) | ✓ | — | — | — | ✓ (optional) | — | — / — | relation, not a column |
| relation key (added, `@serverOnly @writeOnly`) | — | — | — | — | — | — | ✓ / ✓ | ✓ |

1. Clients cannot filter on a value they cannot read. Add `@filterOnly` to a `@writeOnly` field to filter on it anyway.
2. The `…Only` directives combine. `@createOnly @filterOnly` puts a field in both the create input and the filter; the same applies to the Zod create/update schemas.

Notes:

- **"Public SDL type"** is the object type in `schema.graphql` and `appsync/schema.graphql`. `@writeOnly` and `@serverOnly` fields are removed during `cleanup`. The other utility directives are stripped and their fields kept.
- **Generators see the schema before cleanup.** Code generators run in the `generate` phase, which comes *before* `cleanup`, so they still see `@serverOnly` and `@writeOnly` fields and relation keys. The TS schema types and the AppSync resolver types leave them out with `isPublicSchemaField`; Zod and the tables keep them because they describe the stored row. See [Architecture](../internals/architecture.md).
- **Zod create/update schemas describe the stored row, not the GraphQL input.** They include `@readOnly` and `@serverOnly` fields and relation keys, which `Create<Model>Input` does not.
- **The Middy AppSync resolver types** list only public fields, so `@serverOnly` operations get no entry. A resolver's `source` is typed `<Type>Source` when the parent type has hidden stored fields, so resolvers can read relation keys and `@serverOnly` values from the parent row (see [AppSync](./appsync.md)).
- **Unused definitions are removed.** A type, input, enum, union or scalar that nothing public reaches is removed from `schema.graphql` and the AppSync schema, and left out of the TS schema types. Zod skips definitions that no stored field or input reaches.
- **Directives stay on the type that declares them.** Visibility directives on a non-model object type apply to that type's own `<Type>Input` (see [Models](./models.md#mutation-inputs)); they are not inherited from the field that embeds it.

## On an object type

`@serverOnly` and `@clientOnly` can mark a whole object type. A field whose type is such an object inherits the directive (`UtilitiesPlugin.normalize`), so everything in the table above applies to it.

```graphql
type ImportJob @model @serverOnly { … }      # stored, never exposed
type ExchangeRate @model @clientOnly { … }   # resolved at runtime, never stored
type CategoryStats @clientOnly { … }

type Category @model {
  lastImport: ImportJob @belongsTo   # becomes @serverOnly: stored as lastImportId, not exposed
  stats: CategoryStats               # becomes @clientOnly: queryable, no column, no input entry
}
```

- **`@serverOnly` type.** Not in the output schema, the TS schema types or the AppSync resolver types, not even as an implementor of a public interface such as `Node`. It is still stored: Zod and dsqlbase generate it. On a `@model`, it keeps its table and Zod row schemas but gets **no operations** and no GraphQL inputs.
- **`@clientOnly` type.** In the output schema, never stored: no table, no Zod create/update schemas and no `<Type>Input`. On a `@model`, it gets **only the read operations** (`get`, `list`) of those configured, and resolvers provide the data.
- Fields on root types do not inherit `@clientOnly`: a query returning a client-only type is still a query.

## `@constraint`

```graphql
directive @constraint(min: Float, max: Float, pattern: String)
  on FIELD_DEFINITION | INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION
```

Only the Zod generator reads it. It appends `.min(n)`, `.max(n)` and `.regex(/pattern/)` to the leaf schema: string length for strings, value for numbers. It applies to object schemas, the model create/update schemas and, with `generateArgumentSchemas`, to input schemas.

It is removed from the output schema everywhere it can appear: object and interface fields, input fields and arguments.

## Related

- [Models](./models.md)
- [Relations](./relations.md)
- [Zod](./zod.md)
- [Architecture](../internals/architecture.md)
- [Known gaps](../internals/known-gaps.md)
