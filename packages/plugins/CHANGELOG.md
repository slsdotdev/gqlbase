# @gqlbase/plugins

## 0.2.0

### Minor Changes

- 5328484: `appsyncPreset({ dynamoDBFilter: true })` emits `appsync/dynamodb-filter.ts` with `toDynamoDBFilter(filter)` for APPSYNC_JS resolvers. It renames the operators to AppSync's (`neq` → `ne`, `lte` → `le`, `gte` → `ge`, `exists` → `attributeExists`), drops nested `where` conditions and explicit `null`s, rejects `endsWith` with `util.error`, and passes the result to `util.transform.toDynamoDBFilterExpression`.

  Docs: docs/guide/appsync.md#dynamodb-filters

- 226e3b2: The AppSync schema maps a custom scalar by its type hint instead of throwing: `id` → `ID`, `string` → `String`, `number` → `Float`, `boolean` → `Boolean`, `object` → `AWSJSON`. `scalarMappings` still takes precedence. Only a scalar with an `unknown` or missing hint must be mapped, and the error now names the scalar and the option. The hints are recorded during `generate`, since cleanup removes them before `output()`.

  Docs: docs/guide/appsync.md, docs/guide/scalars.md, docs/internals/testing.md

- 512c76e: `appsync/middy-appsync.types.ts` declares an AppSync version of each public object, interface and union under its schema name, built from the schema types' `<Type>OwnFields` with exported utilities: `WithTypename`, `WithRequiredTypename` (unions and interfaces require `__typename`), `WithOptional` and `Override`. Relations are optional and typed with the AppSync versions, so resolvers can return preloaded data. `<Type>Source` builds on the AppSync version. Arguments use the input side of `Scalars`. Only enums, inputs and `Scalars` are re-exported.

  `@computed` marks a field that has its own resolver: it gets an entry, and is optional in its type's AppSync version. It does not imply `@clientOnly`, so a stored field can be computed too. It throws on operation fields, relation fields and fields outside the public schema.

  `middyAppSync.relationsOnly` is replaced by `middyAppSync.resolvers: "declared" | "all"`.

  Migration: `relationsOnly: true` → `resolvers: "declared"`, `relationsOnly: false` → `resolvers: "all"`. Import resolver types from `appsync/middy-appsync.types`.

  Docs: docs/guide/appsync.md#resolver-types, docs/guide/field-visibility.md, docs/guide/configuration.md#migrating-from-01

- 5328484: A filter's `between` is typed as the pair `[T, T]` in the generated TS types and validated with `z.tuple([…, …])` by Zod, so a generated filter, without explicit `null`s, is assignable to dsqlbase's `where`. The schema keeps `[T!]`. The new internal `@gqlbase_tuple(size: Int!)` directive marks such fields and is removed from the output schema.

  Docs: docs/guide/dsqlbase.md#filters-and-orderby, docs/guide/models.md#operator-sets, docs/internals/plugin-api.md

- af89b97: The base plugins move into `@gqlbase/core` and are registered by every transformer, in a fixed order, before the configured plugins. `basePreset()` and the `@gqlbase/plugins/base` / `gqlbase/plugins/base` subpaths are removed; the plugins and their helpers are exported from `@gqlbase/core/plugins`. `isRelayConnection` and `isRelayEdge` also move there. `createTransformer` no longer requires `plugins`.

  Migration: remove `basePreset()` from `plugins`, and move `basePreset({ operations })` to `transform: { operations }`.

  ```diff
  - import { basePreset, relayPreset } from "gqlbase/plugins";
  + import { relayPreset } from "gqlbase/plugins";

    export default defineConfig({
  -   plugins: [basePreset({ operations: ["read"] }), relayPreset()],
  +   transform: { operations: ["read"] },
  +   plugins: [relayPreset()],
    });
  ```

  Docs: docs/guide/configuration.md, docs/internals/architecture.md, docs/internals/plugin-api.md, docs/guide/models.md, docs/guide/relations.md, docs/guide/install.md

- e656207: dsqlbase follows data sources: it emits tables only for the models of the source with `type: "dsqlbase"` (exported as `DSQLBASE_DATA_SOURCE_TYPE`, with `isDsqlBaseTable`), and throws when more than one source has that type. A relation to a model in another source keeps its key column but gets no relation. `@index` and `@unique` apply to its tables only. Without `dataSources`, every stored model is a table, as before.

  Docs: docs/guide/dsqlbase.md#rules, docs/guide/data-sources.md#generators

- 400be01: `dsqlbase()` declares table directives that mirror the dsqlbase schema builders: `@index(name, columns, unique, include, distinctNulls)` (repeatable, on a type), `@unique(fields: [...])` on a type for a composite unique constraint, and `@unique` on a field for a unique column. A new `DsqlBaseUtilsPlugin` declares them, checks that every named field is an indexable column of a stored model once relation keys and tenancy claims exist, rejects duplicate index names, and removes the directives from the output. The generator emits `.unique()` on the column, and `table.index(...)` / `table.unique(...)` statements after the table.

  Docs: docs/guide/dsqlbase.md#indexes-and-unique-constraints, docs/guide/drizzle.md

- 226e3b2: `dsqlbase(options)` passes `scalarMap` and `emitOutput` to the dsqlbase schema generator, so a custom scalar can be mapped to a column (`{ Decimal: { type: "string", dataType: "numeric" } }`) from a config file. `scalarMap` accepts the local `safeint` builder. `@gqlbase/plugins/dsql` exports the option types. This fixes the known gap "`dsqlbase()` factory takes no options".

  Docs: docs/guide/dsqlbase.md, docs/guide/scalars.md, docs/internals/known-gaps.md

- af89b97: With `relay: false` (the default), a `@hasMany` field becomes a plain list that keeps the field's nullability and has non-null items: `posts: Post @hasMany` becomes `[Post!]` (was `[Post]`), and `posts: Post! @hasMany` becomes `[Post!]!`. List queries follow the same rule. Models keep the `filter` argument; there are no pagination arguments without Relay.

  The `{ items, nextToken }` connection shape and `RelationsPlugin`'s `usePaginationTypes` option are removed, along with `isPaginationConnection`. Connections exist only in the Relay format.

  Docs: docs/guide/relations.md, docs/guide/models.md, docs/guide/relay.md

- af89b97: The output schema and the schema types now contain only what reaches the client.
  - New core helpers: `isPublicSchemaField(field, parent)` (not `@serverOnly`, `@writeOnly` or internal), `collectPublicDefinitions(context)`, and `collectReachableDefinitions(context, includeField)`.
  - `SchemaGeneratorPlugin` removes every definition nothing public reaches (unused enums, inputs, unions, scalars, and leftover `@gqlbase_internal` definitions) before printing. `schema.graphql` and the AppSync schema no longer contain them.
  - `schema.types.ts` matches `schema.graphql`: it no longer has `@serverOnly` fields, relation keys or unreachable definitions.
  - The Middy AppSync resolver types list only public fields, so `@serverOnly` operations get no entry. A resolver's `source` is `<Type>Source` (the schema type plus its hidden stored fields: relation keys, `@serverOnly`, `@writeOnly`) when the parent type has any.
  - The Zod generator skips definitions that no field, including stored-only fields, reaches.

  Migration: code that read relation keys or `@serverOnly` fields from the schema types should use the AppSync `<Type>Source` types, or the dsqlbase row types.

  Docs: docs/guide/field-visibility.md, docs/guide/appsync.md, docs/guide/relations.md, docs/guide/scalars.md, docs/guide/zod.md, docs/guide/configuration.md, docs/internals/architecture.md, docs/internals/plugin-api.md, docs/internals/known-gaps.md

- af89b97: Relay is a transformer option. `NodeInterfacePlugin` and `ConnectionPlugin` move into `@gqlbase/core` and are registered right after `RelationsPlugin` when `transform.relay` is on. `relayPreset()` and the `@gqlbase/plugins/relay` / `gqlbase/plugins/relay` subpaths are removed.

  `ConnectionPlugin` reads `semanticNullability` from the options instead of probing the document. With it on, `edges` and `XEdge.node` carry `@semanticNonNull`; with it off, they are plain non-null (`edges: [XEdge!]!`, `node: X!`). Previously `node` was always nullable.

  Migration: replace `relayPreset()` with `transform: { relay: true }`.

  Docs: docs/guide/relay.md, docs/guide/configuration.md, docs/internals/architecture.md, docs/internals/known-gaps.md

- 226e3b2: Adds a built-in `SafeInt` scalar: an integer within `Number.isSafeInteger`, typed `number` (values up to `Number.MAX_SAFE_INTEGER`), filtered like a number, and validated with `z.number().int()`. It maps to `Long` on AppSync and `bigint(…, { mode: "number" })` in Drizzle. `AppSyncUtilsPlugin` declares `Long`. The dsqlbase schema stores it in a `bigint` column through a local `safeint` builder that decodes to `number`. The builder imports `@dsqlbase/core` and is emitted only when a column needs it.

  Docs: docs/guide/scalars.md, docs/guide/dsqlbase.md, docs/guide/appsync.md, docs/guide/zod.md, docs/guide/install.md

- af89b97: Generated file layout:
  - The schema types are written to `schema.types.ts` (was `models.typegen.ts`). `ModelTypesGeneratorPlugin` takes no options any more, and `transform()` always returns their content as `schemaTypes`.
  - The dsqlbase schema moves to `dsqlbase/schema.ts` (was `dsqlbase.schema.ts`).
  - The Middy AppSync types are written to `appsync/middy-appsync.types.ts` (was `middy-appsync.typegen.ts`). Generated type files now all end in `.types.ts`.
  - `dsqlbase/schema.ts` and `appsync/middy-appsync.types.ts` import from `../schema.types` and re-export the schema types they use. A type the schema types do not export (for example a `@serverOnly` object stored in a `json` column, or a hidden field's enum in a `<Type>Source`) is declared in the file itself, through the new `TypesGeneratorBase._referenceType`.
  - `<Type>Source` no longer lists hidden relation fields; the row holds their key.
  - Drizzle is frozen: it keeps compiling and imports from `../schema.types.js`.

  Migration: update imports of `generated/models.typegen` to `generated/schema.types`, of `generated/dsqlbase.schema` to `generated/dsqlbase/schema`, and of `generated/appsync/middy-appsync.typegen` to `generated/appsync/middy-appsync.types`.

  Docs: docs/guide/configuration.md, docs/guide/dsqlbase.md, docs/guide/appsync.md, docs/guide/drizzle.md, docs/guide/relations.md, docs/guide/README.md, docs/internals/known-gaps.md

- 512c76e: `schema.types.ts` becomes support types. Each object and interface has three parts: `<Type>OwnFields` (its fields, without relations), `<Type>Relations` (its relations, all optional) and `<Type>Full` (both); the bare name is gone. A `Scalars` map types each scalar on its `input` and `output` side, and fields reference it. `@gqlbase_typehint` takes an optional `input` hint, and `AWSJSON` is a string on input. `__typename` and `RequiredTypename` are gone. dsqlbase and Drizzle type object columns with `<Type>OwnFields`.

  Migration: `Post` → `PostFull`, or `PostOwnFields` for a stored shape.

  Docs: docs/guide/configuration.md#schema-types, docs/guide/scalars.md#type-hints, docs/guide/relations.md, docs/guide/dsqlbase.md, docs/guide/drizzle.md

- af89b97: Add transformer options `relay`, `semanticNullability` and `operations`, set under `transform` in the config (next to `plugins`) or at the top level of `createTransformer`, and frozen onto `context.options`. `ModelPlugin` reads `operations` from the context. `RfcFeaturesPlugin`, which declares `@semanticNonNull`, is registered only when `semanticNullability: true`; the default is `false`, so a config whose schema uses the directive must set it.

  Docs: docs/guide/configuration.md, docs/guide/models.md, docs/guide/relay.md, docs/internals/plugin-api.md

- af89b97: `@serverOnly` and `@clientOnly` can mark an object type. A field whose type is such an object inherits the directive.
  - `@serverOnly` type: removed from the output schema, the schema types and the AppSync types (also as a `Node` implementor), but still stored. A `@serverOnly @model` keeps its table and Zod row schemas and gets no operations.
  - `@clientOnly` type: in the output schema, never stored. A `@clientOnly @model` gets only its configured read operations (`get`, `list`), no table and no Zod create/update schemas.

  The dsqlbase generator now emits `$enum` only for enums a column uses, instead of every enum in the document.

  Docs: docs/guide/field-visibility.md, docs/guide/models.md, docs/guide/dsqlbase.md, docs/guide/zod.md, docs/guide/README.md

- 2a90a30: `Create<Model>InputSchema` and `Update<Model>InputSchema` match the GraphQL `Create<Model>Input` and `Update<Model>Input`: exactly their fields, so `@readOnly` and `@serverOnly` fields and relation keys are gone. Nullability and `@constraint` checks are unchanged, so an update still rejects `null` on a required field. A model gets a schema only for the inputs it has, and nested object fields reference `<Type>InputSchema`, derived from the nested `<Type>Input`, instead of the output `<Type>Schema`. `shouldIncludeInZodCreate` and `shouldIncludeInZodUpdate` are removed.

  Migration: validate `args.input` with the schema, then add the values the server sets (timestamps, relation keys, `@serverOnly` fields) to the data you write.

  Docs: docs/guide/zod.md, docs/guide/field-visibility.md, docs/guide/models.md#partial-updates-and-null, docs/guide/relations.md

- 2a90a30: The Zod object schemas follow the public schema. `<Type>Schema` leaves out `@serverOnly` fields (as it already did `@writeOnly` ones), and definitions the client schema does not reach get no schema: `@serverOnly` types, including `@serverOnly @model` types and implementors of public interfaces, and anything only `@serverOnly` fields reach. A union lists only its public members.

  Migration: a database row parsed with `<Type>Schema` no longer keeps its `@serverOnly` values. Type rows with the dsqlbase row types instead.

  Docs: docs/guide/zod.md, docs/guide/field-visibility.md

- 226e3b2: `zodSchemaGeneratorPlugin({ scalars })` sets the Zod code for a named scalar (custom, gqlbase built-in or GraphQL), used instead of the built-in mapping or the type hint, for example `{ Currency: 'z.string().regex(/^[A-Z]{3}$/)' }`.

  Docs: docs/guide/zod.md, docs/guide/scalars.md

### Patch Changes

- 917368b: `@index` columns no longer take `sort`, and `DsqlSortOrder` is gone: dsqlbase 0.2.0 removed `.sort()` from index columns, since DSQL refuses `ASC` / `DESC` on index keys. `nulls` remains.

  Docs: docs/guide/dsqlbase.md#indexes-and-unique-constraints

- Updated dependencies [5328484]
- Updated dependencies [af89b97]
- Updated dependencies [e656207]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [c186041]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [af89b97]
- Updated dependencies [af89b97]
- Updated dependencies [5328484]
- Updated dependencies [512c76e]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [af89b97]
- Updated dependencies [226e3b2]
- Updated dependencies [af89b97]
- Updated dependencies [512c76e]
- Updated dependencies [e656207]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [a34bc19]
- Updated dependencies [af89b97]
- Updated dependencies [af89b97]
- Updated dependencies [c186041]
- Updated dependencies [c186041]
  - @gqlbase/core@0.2.0
  - @gqlbase/shared@0.2.0

## 0.1.11

### Patch Changes

- 66f689e: Plugin fixes
  - @gqlbase/core@0.1.11
  - @gqlbase/shared@0.1.11

## 0.1.10

### Patch Changes

- 09b33a7: Fix zod schemas dependency refs
  - @gqlbase/core@0.1.10
  - @gqlbase/shared@0.1.10

## 0.1.9

### Patch Changes

- 2fe3339: zod plugin: derive create/update schemas from `@model` types
  - `ZodSchemaGeneratorPlugin` now emits `Create${Model}InputSchema` and `Update${Model}InputSchema` directly from each `@model` object instead of the public GraphQL input. The schemas describe the full persistence row: `@serverOnly` and `@readOnly` fields are included; relations, `@clientOnly`, and the opposing `@createOnly`/`@updateOnly` fields are excluded. Non-null model fields on update are now `.optional()` (no `.nullable()`); nullable fields stay `.optional().nullable()`. `id` is required on update and optional on create.
  - Input definitions are no longer matched by default. New `generateArgumentSchemas` option (default `false`) walks every field argument across Query/Mutation/Subscription and object fields, emitting zod schemas for argument types and their transitive dependencies (filter inputs, custom inputs). Already-emitted names are not overwritten.
  - `ModelPlugin.execute()` now respects `@model(operations:)` when building inputs — `CreateXInput` / `UpdateXInput` / `XFilterInput` are only emitted for the corresponding enabled operations.
  - `basePreset()` accepts `{ operations }` and forwards it to `ModelPlugin`.
  - `MiddyAppSyncGraphQLPlugin` moved from `@gqlbase/plugins/middy` to `@gqlbase/plugins/appsync` and is now bundled inside `appsyncPreset()` via the new `middyAppSync` option.
  - @gqlbase/core@0.1.9
  - @gqlbase/shared@0.1.9

## 0.1.8

### Patch Changes

- 25c27f1: codegen fixes
  - @gqlbase/core@0.1.8
  - @gqlbase/shared@0.1.8

## 0.1.7

### Patch Changes

- ff979f8: Added DsqlBaseSchemaGeneratorPlugin
  - @gqlbase/core@0.1.7
  - @gqlbase/shared@0.1.7

## 0.1.6

### Patch Changes

- c677464: Fix relations key parsing
- 18da481: Update deps
- Updated dependencies [18da481]
  - @gqlbase/shared@0.1.6
  - @gqlbase/core@0.1.6

## 0.1.5

### Patch Changes

- c265909: Added DrizzleSchemaGenerator plugin
  - @gqlbase/core@0.1.5
  - @gqlbase/shared@0.1.5

## 0.1.4

### Patch Changes

- cd20bc5: Added ZodSchemaGeneratorPlugin
  - @gqlbase/core@0.1.4
  - @gqlbase/shared@0.1.4

## 0.1.3

### Patch Changes

- ef8127f: Bug fixes and improvements
- 5c99042: relations only typegen for MyddyAppSyncGraphQLPlugin option
  - @gqlbase/core@0.1.3
  - @gqlbase/shared@0.1.3

## 0.1.2

### Patch Changes

- feca490: Added `@belongsTo` on RelationsPlugin
- Updated dependencies [feca490]
  - @gqlbase/core@0.1.2
  - @gqlbase/shared@0.1.2

## 0.1.1

### Patch Changes

- 06cd90b: Base plugins fixes
  - fixes key generation for operation nodes
  - adds filters for `hasMany` relations on model fields
  - runs model transformation in two stages to avoid positioning issues

- 72052ff: Added MiddyAppSyncGraphQLPlugin
  - @gqlbase/core@0.1.1
  - @gqlbase/shared@0.1.1

## 0.1.0

### Minor Changes

- 24f07c8: Transformer outputs file contents rather than write to fs.

### Patch Changes

- Updated dependencies [24f07c8]
  - @gqlbase/shared@0.1.0
  - @gqlbase/core@0.1.0

## 0.0.10

### Patch Changes

- cbd7391: Update dependencies
- Updated dependencies [cbd7391]
  - @gqlbase/shared@0.0.10
  - @gqlbase/core@0.0.10

## 0.0.9

### Patch Changes

- Updated dependencies [ec95c9c]
  - @gqlbase/shared@0.0.9
  - @gqlbase/core@0.0.9

## 0.0.8

### Patch Changes

- 2f3cc44: Added `appSyncPreset` with `AppSynUtilsPlugin` for aws appsync support
- 2f3cc44: Added AppSyncSchemaGeneratorPlugin
  - @gqlbase/core@0.0.8
  - @gqlbase/shared@0.0.8

## 0.0.7

### Patch Changes

- 309082b: Add test coverage for `ConnectionPlugin` and detect conflicting pagination connection types from `RelationsPlugin`.
- 309082b: Add comprehensive test coverage for `NodeInterfacePlugin` and refactor plugin to use `TransformerPluginBase`.
- 309082b: Fix level-aware semantic nullability in type generation. `isSemanticNullable` now unwraps to the correct depth level, and `ModelTypesGeneratorPlugin` wraps inner list types with `Maybe` when they are nullable at their respective level.
- 309082b: Added InterfaceUtilsPlugin
- 309082b: Added RfcFeaturesPlugin
- Updated dependencies [309082b]
  - @gqlbase/core@0.0.7
  - @gqlbase/shared@0.0.7

## 0.0.6

### Patch Changes

- dc22a95: Add README files for all packages
- Updated dependencies [dc22a95]
  - @gqlbase/core@0.0.6
  - @gqlbase/shared@0.0.6

## 0.0.5

### Patch Changes

- acf3f62: Added ScalarsPlugin
- a53c785: Added ModelTypesGeneratorPlugin
  - @gqlbase/core@0.0.5
  - @gqlbase/shared@0.0.5

## 0.0.4

### Patch Changes

- deb9567: feat: base preset plugins
  - @gqlbase/core@0.0.4
  - @gqlbase/shared@0.0.4

## 0.0.2

### Patch Changes

- 68109c1: feat(plugins): added ModelPlugin
- Updated dependencies [52f4e5d]
- Updated dependencies [fbc977e]
- Updated dependencies [d09d42e]
- Updated dependencies [710da2f]
- Updated dependencies [68109c1]
- Updated dependencies [4cbe6d8]
  - @gqlbase/core@0.0.3
  - @gqlbase/shared@0.0.2
