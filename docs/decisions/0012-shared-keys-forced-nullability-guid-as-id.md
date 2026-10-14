# 0012 — Shared relation keys, forced semantic nullability, `GUID` printed as `ID`

- **Date:** 2026-10-14
- **Status:** accepted
- **Proposal:** none. Planned in session and recorded here.

## Context

There were three problems:
- **Shared keys.** A `@belongsTo` and its inverse `@hasOne`/`@hasMany` usually add the same key field. Whichever was normalized first created it with its own nullability. So document order decided whether a nullable `@belongsTo` got a `notNull()` column. Inverse relations also made keys non-null from their own nullability, which says what they resolve, not what a target row stores.
- **Repetitive annotations.** Schemas that want error-tolerant clients had to annotate every field with `@semanticNonNull`.
- **Relay.** `GUID` reached the public schema, but Relay needs `Node.id: ID`.

## Decision

- **Only a `@belongsTo` decides whether a key is required.** A `@hasOne`/`@hasMany` adds a nullable key. It adds nothing to a member whose own `@belongsTo` (or an interface's) stores the same key. The check reads the source schema, so the outcome does not depend on order, and no added field is ever retyped. Declared keys are kept as declared.
- **Relations pair by key name, checked for polymorphism.** When an inverse relation's key matches a `@belongsTo` on the target, every object the source stands for must be among the objects the `@belongsTo` target stands for. Otherwise the transform throws. Inverses are never inferred from types, because a type can hold several relations to the same source.
- **A non-null `@hasOne` is not enforced.** It promises that every source has a target, and no key on the target can express that. A missing row surfaces at runtime as GraphQL's non-null error.
- **`discriminatorSuffix` option** (default `"type"`). `parseFieldRelation` takes it as a required argument, so every caller names the same field.
- **`semanticNullability: "force"`.**
  - `RfcFeaturesPlugin.cleanup` moves every non-null level of every object and interface field into `@semanticNonNull(levels)`, merged with declared levels. `id` is exempt.
  - It runs after `generate`. Generators read `!` and the directive alike, so only the printed schemas change, and generated fields are covered too.
- **`GUID` is printed as `ID`.**
  - `ScalarsPlugin.after` rewrites every reference and drops the scalar.
  - `FilterPlugin` filters `GUID` fields with the `ID` inputs, which have the same operators.
  - Everything before printing still sees `GUID`.

Rejected:
- Letting a `@belongsTo` retype a key an inverse relation added first, tracking which plugin-added fields a `@belongsTo` owns. It works, but it keeps the inverse relations deciding storage and needs mutable bookkeeping.
- Making the key's nullability final in a later phase. Inputs, filters and validation read keys during `execute`.
- An error or warning for a non-null `@hasOne` without a `@belongsTo` on the target. A `@belongsTo` constrains the other direction, so it would check the wrong thing.
- Changing the default suffix to `Kind`. It would rename existing columns.
- Converting fields in `before`/`normalize`. Generated fields would be missed, and the outcome would depend on plugin order.
- A dsqlbase option that treats `ID` as a global id. It would spread `GUID` logic across core and dsqlbase.
- Renaming `GUIDFilterInput` after the fact. Sharing `IDFilterInput` avoids two identical inputs.

## Consequences

- `minor`, breaking for clients: `GUID` becomes `ID` and `GUIDFilterInput` goes away.
- Keys added only by a non-null `@hasOne`/`@hasMany` become nullable, and keys stored by a non-null `@belongsTo` that lost to a nullable inverse become required. Both need a migration.
- Force mode leaves `PageInfo` booleans and connection fields semantically non-null. Clients that need strict `!` can keep `true`.

## Docs

- [Relations](../guide/relations.md)
- [Models → Nullability](../guide/models.md#nullability-and-semanticnonnull)
- [Scalars → GUID](../guide/scalars.md#guid)
- [Relay](../guide/relay.md)
- [Configuration](../guide/configuration.md#transformer-options)
