# Field visibility

_Audience: people controlling where a field appears — public schema, inputs, filters, generated code, database._

The utility directives are declared by `UtilitiesPlugin` (`packages/plugins/src/base/UtilitiesPlugin/UtilitiesPlugin.ts`; predicates such as `isReadOnly` in `UtilitiesPlugin.utils.ts`), part of `basePreset()`. All of them go on `FIELD_DEFINITION`. `@constraint` also goes on `INPUT_FIELD_DEFINITION` and `ARGUMENT_DEFINITION`.

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

There is no central rule. Each generator applies its own, and they differ, which is why this page exists. The table was derived from the code:

- **SDL**: `UtilitiesPlugin.cleanup`.
- **GraphQL inputs**: `ModelPlugin.utils.ts`.
- **TS**: `ModelTypesGeneratorPlugin`.
- **Zod**: `ZodSchemaGeneratorPlugin` and `ZodSchemaGeneratorPlugin.utils.ts`.
- **DB**: `DsqlBaseSchemaGeneratorPlugin` and `DrizzleSchemaGeneratorPlugin`.

The entries were checked by running the transformer.

✓ = present, — = absent.

| Field marked | Public SDL type | Create input | Update / upsert input | Filter input | TS model type | Zod `<Type>Schema` | Zod `Create`/`Update…InputSchema` | DB column |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| *(nothing)* | ✓ | ✓ | ✓ (nullable) | ✓ | ✓ | ✓ | ✓ / ✓ | ✓ |
| `@readOnly` | ✓ | — | — | — | ✓ | ✓ | ✓ / ✓ | ✓ |
| `@writeOnly` | — | ✓ | ✓ | ✓ ¹ | — ² | — | ✓ / ✓ | ✓ |
| `@serverOnly` | — | — | — | — | ✓ | ✓ | ✓ / ✓ | ✓ |
| `@clientOnly` | ✓ | — | — | — | ✓ | ✓ | — / — | — |
| `@createOnly` | ✓ | ✓ | — | — ³ | ✓ | ✓ | ✓ / — | ✓ |
| `@updateOnly` | ✓ | — | ✓ | — ³ | ✓ | ✓ | — / ✓ | ✓ |
| `@filterOnly` | ✓ | — ³ | — ³ | ✓ | ✓ | ✓ | — / — ³ | ✓ |
| relation field (`@hasOne`…) | ✓ | — | — | — | ✓ (optional) | — | — / — | relation, not a column |
| relation key (added, `@serverOnly @writeOnly`) | — | — | — | — | ✓ | — | ✓ / ✓ | ✓ |

1. `@writeOnly` is not excluded from filter inputs, so clients can filter on a value they cannot read. See [Known gaps](../internals/known-gaps.md).
2. Unless the field is also `@serverOnly`.
3. The `…Only` directives combine. `@createOnly @filterOnly` puts a field in both the create input and the filter; the same applies to the Zod create/update schemas.

Notes:

- **"Public SDL type"** is the object type in `schema.graphql` and `appsync/schema.graphql`. `@writeOnly` and `@serverOnly` fields are removed during `cleanup`. The other utility directives are stripped and their fields kept.
- **Generators see the schema before cleanup.** Code generators run in the `generate` phase, which comes *before* `cleanup`, so they still see `@serverOnly` and `@writeOnly` fields and relation keys. That is why the TS types, Zod schemas and tables contain them. See [Architecture](../internals/architecture.md).
- **Zod create/update schemas describe the stored row, not the GraphQL input.** They include `@readOnly` and `@serverOnly` fields and relation keys, which `Create<Model>Input` does not.
- **The Middy AppSync resolver types** are also built in `generate`. Root-type fields therefore appear there even when marked `@serverOnly`.
- **Directives stay on the type that declares them.** Visibility directives on a non-model object type apply to that type's own `<Type>Input` (see [Models](./models.md#mutation-inputs)); they are not inherited from the field that embeds it.

## `@constraint`

```graphql
directive @constraint(min: Float, max: Float, pattern: String)
  on FIELD_DEFINITION | INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION
```

Only the Zod generator reads it. It appends `.min(n)`, `.max(n)` and `.regex(/pattern/)` to the leaf schema: string length for strings, value for numbers. It applies to object schemas, the model create/update schemas and, with `generateArgumentSchemas`, to input schemas.

Removal from the output schema is incomplete:
- it is removed from object and interface fields;
- it is **not** removed from input fields or arguments, even though its directive definition is removed. `input SearchInput { term: String @constraint(min: 2) }` is printed with a dangling directive.

See [Known gaps](../internals/known-gaps.md).

## Related

- [Models](./models.md)
- [Relations](./relations.md)
- [Zod](./zod.md)
- [Architecture](../internals/architecture.md)
- [Known gaps](../internals/known-gaps.md)
