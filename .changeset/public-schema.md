---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

The output schema and the schema types now contain only what reaches the client.

- New core helpers: `isPublicSchemaField(field, parent)` (not `@serverOnly`, `@writeOnly` or internal), `collectPublicDefinitions(context)`, and `collectReachableDefinitions(context, includeField)`.
- `SchemaGeneratorPlugin` removes every definition nothing public reaches (unused enums, inputs, unions, scalars, and leftover `@gqlbase_internal` definitions) before printing. `schema.graphql` and the AppSync schema no longer contain them.
- `schema.types.ts` matches `schema.graphql`: it no longer has `@serverOnly` fields, relation keys or unreachable definitions.
- The Middy AppSync resolver types list only public fields, so `@serverOnly` operations get no entry. A resolver's `source` is `<Type>Source` (the schema type plus its hidden stored fields: relation keys, `@serverOnly`, `@writeOnly`) when the parent type has any.
- The Zod generator skips definitions that no field, including stored-only fields, reaches.

Migration: code that read relation keys or `@serverOnly` fields from the schema types should use the AppSync `<Type>Source` types, or the dsqlbase row types.

Docs: docs/guide/field-visibility.md, docs/guide/appsync.md, docs/guide/relations.md, docs/guide/scalars.md, docs/guide/zod.md, docs/guide/configuration.md, docs/internals/architecture.md, docs/internals/plugin-api.md, docs/internals/known-gaps.md
