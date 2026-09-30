# 0003 — Core plugins, transformer options, and a schema that matches its types

- **Date:** 2026-09-30
- **Status:** accepted
- **Proposal:** `core-restructure.md`

## Context

The base plugins (models, relations, visibility, scalars, the SDL and types output) shipped as `basePreset()`, which a config could leave out or reorder. Every other plugin depended on them anyway, and some depended on each other: the dsql and Drizzle generators imported from `relay/`. Features were detected by probing the document; `ConnectionPlugin`, for example, checked whether `@semanticNonNull` was declared. There were two connection shapes. The generated types were built before `cleanup`, so they did not match the output schema.

## Decision

- **Core plugins.** The base plugins live in `@gqlbase/core` (`packages/core/src/plugins/`, listed in `corePlugins.ts`). `createTransformer` registers them in a fixed order, before the configured plugins. `basePreset()` and `relayPreset()` are removed.
- **Transformer options on the context.** `relay`, `semanticNullability` and `operations` (defaults `false`, `false`, `["read", "write"]`) are set under `transform` in the config, or at the top level of `createTransformer`. They are frozen onto `context.options`. Plugins read them there and do not probe the document. Feature plugins (`RfcFeaturesPlugin`, `NodeInterfacePlugin`, `ConnectionPlugin`) are registered only when their option is on.
- **Dependency rule.** Any plugin may rely on the core plugins and import their helpers from `@gqlbase/core/plugins`. No plugin may depend on an optional plugin, so the capability plugins in `@gqlbase/plugins` never import each other. A helper two of them need moves into core.
- **Relay connections only.** With `relay: false`, a `@hasMany` field is a plain list (`[T!]`, or `[T!]!` for a non-null field) with `filter` and no pagination arguments. The `{ items, nextToken }` shape is removed.
- **One public rule.** `isPublicSchemaField` decides what reaches the client schema. `SchemaGeneratorPlugin` prunes every definition nothing public reaches before printing. The schema types (`schema.types.ts`) match `schema.graphql`. `@serverOnly` and `@clientOnly` also apply to object types, and fields returning such a type inherit the directive.
- **One types file; capabilities add only the difference.** Core writes `schema.types.ts`. Each capability plugin writes into its own folder, imports and re-exports the schema types it uses, and declares locally only what the schema types lack (for example the AppSync `<Type>Source` types). Generated type-only files end in `.types.ts`.
- **Drizzle is frozen.** It keeps compiling but gets no new features. dsqlbase is the maintained database target.

## Consequences

- Configs change: presets go, options move under `transform`, and output paths change (`schema.types.ts`, `dsqlbase/schema.ts`, `appsync/middy-appsync.types.ts`). All of this ships in 0.2.0, released as `minor` changesets in the fixed group. The migration is in [Configuration → Migrating from 0.1](../guide/configuration.md#migrating-from-01).
- Plugins can rely on each other's core helpers without guarding for a missing preset. They can no longer detect a feature by probing the document for a definition.
- The core plugins cannot be removed, replaced or reordered. A config that needs a different base has to be solved with options, or with a new core option.
- The output schema, the schema types and the AppSync types share one rule, so a field hidden from one is hidden from all. Stored outputs (Zod row schemas, dsqlbase tables) keep hidden fields by design.
- Capability files can be imported on their own. They depend only on `schema.types.ts`, never on another capability's output.

## Docs

- [Architecture](../internals/architecture.md): core plugins, registration order, the dependency rule and pruning.
- [Plugin API](../internals/plugin-api.md): `context.options`, depending on other plugins, and the public-schema helpers for generators.
- [Configuration](../guide/configuration.md): transformer options, core plugins, output files, and migrating from 0.1.
- [Relay](../guide/relay.md), [Relations](../guide/relations.md): relay as an option and the list shapes.
- [Field visibility](../guide/field-visibility.md): the public rule and type-level visibility.
