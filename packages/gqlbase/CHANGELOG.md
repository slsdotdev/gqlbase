# gqlbase

## 0.2.0

### Minor Changes

- a28b646: **Breaking:** 0.2.0 restructures the configuration and the generated output. Follow the [migration guide](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/configuration.md#migrating-from-01).

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

### Patch Changes

- a28b646: The `gqlbase` package exports `createTransformer` from `"."`, re-exports `gqlbase/config` and `gqlbase/plugins[/<name>]`, and ships the `gqlbase` binary.

  Read more: [Install](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/install.md).

- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [e656207]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
  - @gqlbase/core@0.2.0
  - @gqlbase/plugins@0.2.0
  - @gqlbase/cli@0.2.0
  - @gqlbase/shared@0.2.0

## 0.1.11

### Patch Changes

- Updated dependencies [66f689e]
  - @gqlbase/plugins@0.1.11
  - @gqlbase/cli@0.1.11
  - @gqlbase/core@0.1.11
  - @gqlbase/shared@0.1.11

## 0.1.10

### Patch Changes

- Updated dependencies [09b33a7]
  - @gqlbase/plugins@0.1.10
  - @gqlbase/cli@0.1.10
  - @gqlbase/core@0.1.10
  - @gqlbase/shared@0.1.10

## 0.1.9

### Patch Changes

- Updated dependencies [2fe3339]
  - @gqlbase/plugins@0.1.9
  - @gqlbase/cli@0.1.9
  - @gqlbase/core@0.1.9
  - @gqlbase/shared@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [25c27f1]
  - @gqlbase/plugins@0.1.8
  - @gqlbase/cli@0.1.8
  - @gqlbase/core@0.1.8
  - @gqlbase/shared@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [ff979f8]
  - @gqlbase/plugins@0.1.7
  - @gqlbase/cli@0.1.7
  - @gqlbase/core@0.1.7
  - @gqlbase/shared@0.1.7

## 0.1.6

### Patch Changes

- 18da481: Update deps
- Updated dependencies [c677464]
- Updated dependencies [18da481]
  - @gqlbase/plugins@0.1.6
  - @gqlbase/shared@0.1.6
  - @gqlbase/cli@0.1.6
  - @gqlbase/core@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [c265909]
  - @gqlbase/plugins@0.1.5
  - @gqlbase/cli@0.1.5
  - @gqlbase/core@0.1.5
  - @gqlbase/shared@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [cd20bc5]
  - @gqlbase/plugins@0.1.4
  - @gqlbase/cli@0.1.4
  - @gqlbase/core@0.1.4
  - @gqlbase/shared@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [ef8127f]
- Updated dependencies [5c99042]
  - @gqlbase/plugins@0.1.3
  - @gqlbase/cli@0.1.3
  - @gqlbase/core@0.1.3
  - @gqlbase/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [feca490]
  - @gqlbase/plugins@0.1.2
  - @gqlbase/core@0.1.2
  - @gqlbase/cli@0.1.2
  - @gqlbase/shared@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [06cd90b]
- Updated dependencies [72052ff]
  - @gqlbase/plugins@0.1.1
  - @gqlbase/cli@0.1.1
  - @gqlbase/core@0.1.1
  - @gqlbase/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [24f07c8]
  - @gqlbase/plugins@0.1.0
  - @gqlbase/shared@0.1.0
  - @gqlbase/core@0.1.0
  - @gqlbase/cli@0.1.0

## 0.0.10

### Patch Changes

- Updated dependencies [cbd7391]
  - @gqlbase/plugins@0.0.10
  - @gqlbase/shared@0.0.10
  - @gqlbase/core@0.0.10
  - @gqlbase/cli@0.0.10

## 0.0.9

### Patch Changes

- Updated dependencies [ec95c9c]
  - @gqlbase/shared@0.0.9
  - @gqlbase/cli@0.0.9
  - @gqlbase/core@0.0.9
  - @gqlbase/plugins@0.0.9

## 0.0.8

### Patch Changes

- Updated dependencies [2f3cc44]
- Updated dependencies [2f3cc44]
  - @gqlbase/plugins@0.0.8
  - @gqlbase/cli@0.0.8
  - @gqlbase/core@0.0.8
  - @gqlbase/shared@0.0.8

## 0.0.7

### Patch Changes

- Updated dependencies [309082b]
- Updated dependencies [309082b]
- Updated dependencies [309082b]
- Updated dependencies [309082b]
- Updated dependencies [309082b]
- Updated dependencies [309082b]
  - @gqlbase/plugins@0.0.7
  - @gqlbase/core@0.0.7
  - @gqlbase/cli@0.0.7
  - @gqlbase/shared@0.0.7

## 0.0.6

### Patch Changes

- dc22a95: Add README files for all packages
- Updated dependencies [dc22a95]
  - @gqlbase/core@0.0.6
  - @gqlbase/cli@0.0.6
  - @gqlbase/plugins@0.0.6
  - @gqlbase/shared@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [acf3f62]
- Updated dependencies [41852e8]
- Updated dependencies [a53c785]
  - @gqlbase/plugins@0.0.5
  - @gqlbase/cli@0.0.5
  - @gqlbase/core@0.0.5
  - @gqlbase/shared@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [deb9567]
  - @gqlbase/plugins@0.0.4
  - @gqlbase/cli@0.0.4
  - @gqlbase/core@0.0.4
  - @gqlbase/shared@0.0.4
