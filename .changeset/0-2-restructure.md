---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
"@gqlbase/cli": minor
"gqlbase": minor
---

**Breaking:** 0.2.0 restructures the configuration and the generated output. Follow the [migration guide](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/configuration.md#migrating-from-01).

- **Core plugins.** Models, relations, filters, field visibility, scalars and the SDL and TypeScript outputs are core plugins that every transformer registers. `basePreset()`, `relayPreset()` and their `plugins/base` and `plugins/relay` subpaths are removed. The plugins and their helpers are exported from `@gqlbase/core/plugins`, and `createTransformer` no longer requires `plugins`.
- **Transformer options** are set under `transform` in the config: `relay` (was `relayPreset()`), `semanticNullability` (required for `@semanticNonNull`), `operations` (was `basePreset({ operations })`), `tenancy` and `dataSources`.
- **Lists.** Without Relay, `@hasMany` fields and list queries return `[T!]` and keep the field's nullability. The `{ items, nextToken }` shape is removed. With Relay and without `semanticNullability`, `edges` is `[XEdge!]!` and `XEdge.node` is non-null.
- **Generated files.** `schema.types.ts` (was `models.typegen.ts`), `dsqlbase/schema.ts` (was `dsqlbase.schema.ts`), `appsync/middy-appsync.types.ts` (was `appsync/middy-appsync.typegen.ts`).
- **Schema types.** Each object and interface is split into `<Type>OwnFields`, `<Type>Relations` and `<Type>Full`; the bare name is gone. Scalars are typed through a `Scalars` map with `input` and `output` sides.
- **Public schema.** `schema.graphql`, the AppSync schema and the schema types contain only what clients can reach: no `@serverOnly` or `@writeOnly` fields, no relation keys, no unused definitions.
- **Type visibility.** `@serverOnly` and `@clientOnly` can mark an object type: a `@serverOnly` type is stored but never public, a `@clientOnly` type is public but never stored.
- **Schemas that now fail.** `extend` of an undeclared type no longer disappears silently: `extend type Query`, `Mutation` or `Subscription` creates the root type, and any other extension of an undeclared type, or of the wrong kind, throws.
- **Drizzle removed.** The Drizzle generator and `@gqlbase/plugins/drizzle` are removed; dsqlbase is the database target.
- **Dependencies.** `graphql` (`^16.8.1`) is the only peer dependency. TypeScript 6 is a dependency, so a project can use any TypeScript version. Node.js 22 or later.

Read more: [Install](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/install.md), [Configuration](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/configuration.md), [Field visibility](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/field-visibility.md#on-an-object-type).
