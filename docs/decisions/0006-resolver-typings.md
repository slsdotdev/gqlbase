# 0006 — Schema types as parts; AppSync types under the API's names; `@computed`

- **Date:** 2026-10-03
- **Status:** accepted
- **Proposal:** `field-resolvers.md`

## Context

The middy resolver types typed operation and relation fields only, or every field. A computed field such as `Product.reviewCount` could not get a typed resolver without typing everything, and its parent's resolver was required to return it anyway. Resolver code used the public types in `schema.types.ts`, which mixed resolver concerns into them (`__typename`, relations typed optional among the own fields), and the AppSync file re-exported all of them. Patching those types in the AppSync file (`Omit` and re-declared fields) made it hard to read.

## Decision

- **`schema.types.ts` holds support types.** Each object and interface has `<Type>OwnFields` (no relations), `<Type>Relations` (always optional) and `<Type>Full`, for every type alike, with no type under the bare name. A `Scalars` map types each scalar on its `input` and `output` side; `@gqlbase_typehint` takes an optional `input` (AWSJSON is a string on input). `__typename` is not in it.
- **The AppSync file declares the API's types under their schema names**, built from `<Type>OwnFields` with exported utilities: `WithTypename`, `WithRequiredTypename`, `WithOptional`, `Override`. Relations are optional and typed with the AppSync versions, so resolvers can return preloaded data. Unions and interfaces require `__typename`. An own field is overridden only when the type it holds differs in AppSync. It re-exports only what AppSync does not change: enums, inputs, `Scalars`.
- **`source` is GraphQL's.** AppSync calls each attached resolver separately and passes what the parent field's resolver returned. gqlbase types it, never reshapes it: no parent inference, no `@parent`, no `@namespace`.
- **A typing is not a resolver.** An entry in `Definition` lets a resolver be written; without an attached resolver, AppSync reads the value from `source`.
- **`@computed` marks a field with its own resolver.** The AppSync capability declares it. The field is typed, and optional in its type's AppSync version. It is independent of visibility: `@computed @clientOnly` is never stored, `@computed` alone is a column a resolver may compute while it is unset (a cached value, stored once the record is locked).
- **`relationsOnly` becomes `resolvers: "declared" | "all"`.** The mode chooses which fields are typed, never which may be left out.
- **A declared `key:` on a relation without a key field must exist.** It names the field the resolver queries by; it is not added, since a plain parent has no `id` to type it with.

## Consequences

- Breaking for 0.2.0: the bare names leave `schema.types.ts` (`Post` → `PostFull`, or `PostOwnFields` for a stored shape), scalars are typed through `Scalars`, `__typename` moves to the AppSync file, and `relationsOnly` is renamed. `minor` changesets in the fixed group, with a migration note.
- The stored outputs (dsqlbase, Drizzle) type object columns with `<Type>OwnFields`.
- A `@computed` field is optional in the AppSync types, so they no longer guarantee it on the parent: the cost of `@computed`, paid only where it is used. A changed type is overridden in every type that holds it, at any depth.
- Generated names live next to the schema's: a schema type named `PostFull`, `Scalars`, `Override` or `PostSource` throws.

## Docs

- [Configuration → Schema types](../guide/configuration.md#schema-types), [Scalars → Type hints](../guide/scalars.md#type-hints)
- [AppSync → Resolver types](../guide/appsync.md#resolver-types), [Computed fields](../guide/appsync.md#computed-fields)
- [Field visibility](../guide/field-visibility.md), [Relations](../guide/relations.md)
- [Configuration → Migrating from 0.1](../guide/configuration.md#migrating-from-01)
