# @gqlbase/plugins

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

- a28b646: AppSync resolver types and DynamoDB filters.

  - `appsync/middy-appsync.types.ts` declares an AppSync version of each public object, interface and union under its schema name. Relations are optional, so a resolver can return preloaded data. A resolver's `source` is `<Type>Source`, which adds the hidden stored fields (relation keys, `@serverOnly`, `@writeOnly`). Only enums, inputs and `Scalars` are re-exported.
  - **Breaking:** `middyAppSync.relationsOnly` is replaced by `resolvers: "declared" | "all"` (`true` → `"declared"`, the default; `false` → `"all"`).
  - `@computed` marks a field that has its own resolver: it gets an entry and is optional in its type.
  - `appsyncPreset({ dynamoDBFilter: true })` emits `appsync/dynamodb-filter.ts`, whose `toDynamoDBFilter(filter)` turns a generated filter input into a DynamoDB filter for APPSYNC_JS resolvers.

  Read more: [AppSync](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/appsync.md).

- e656207: Data sources.

  - `transform.dataSources` declares named stores (`{ db: { type: "dsqlbase", default: true }, integrations: { type: "service" } }`), and `@dataSource(name:)` puts a stored model in one. A model without it is in the default source.
  - Operations, relation keys, tenancy and the public schema are the same in every source. Generators read the source with `getDataSource` and `isInDataSourceType`.
  - dsqlbase emits tables only for the source with `type: "dsqlbase"`, and throws when more than one source has that type. A relation to a model in another source keeps its key column but gets no relation; a key to a `GUID` model there is `text()`.
  - Without `dataSources`, nothing changes.

  Read more: [Data sources](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/data-sources.md).

- a28b646: **Breaking:** the generated dsqlbase schema requires `dsqlbase@^0.2`.

  - **Options.** `dsqlbase({ scalarMap, emitOutput })`, so a config file can map a custom scalar to a column (`{ Decimal: { type: "string", dataType: "numeric" } }`). `@gqlbase/plugins/dsql` exports the option types.
  - **Indexes.** `@index(name, columns, unique, include, distinctNulls)` on a type, `@unique(fields:)` on a type for a composite constraint, and `@unique` on a field. Every named field must be an indexable column (not a relation, `@clientOnly` or `jsonb` column), and index names must be unique.
  - **Global ids.** A model with `id: GUID!` has a `guid("id")` primary key, and keys that hold its ids are `guid()` columns. Every table carries `.meta({ __typename })`, so rows have `$$meta.__typename`.
  - **Polymorphic relations.** A relation to a union or interface of tables relates to an exported `union()`. A `@belongsTo` stores a `guid()` key and a `text` discriminator.
  - **Column defaults.** `@defaultNow`, `@defaultRandom` and `@default(value:, onCreate:, onUpdate:)`. A field with a database default or `onCreate` is optional in the create input and its Zod schema.
  - `$enum` is emitted only for enums a column uses.

  Read more: [dsqlbase](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/dsqlbase.md).

- a28b646: **Breaking:** dsqlbase stores list fields as `array()` and other object fields as `record()` columns, both `jsonb` (they were `json`), so list filters run. DSQL cannot change a column's type in place: add a column, backfill it, then switch. See [Upgrading existing tables](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/embedded-objects.md#upgrading-existing-tables).

  - `@embedded` on an object type stores its fields as a column group (`price_amount`, `price_currency`) through an `embedded({...})` shape. An embedded type cannot be a `@model`, have an `id` or relations, or contain itself through non-list members.
  - `@index` and `@unique` name an embedded member by path (`"price.amount"`), and `orderBy` reaches its members.

  Read more: [Embedded objects](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/embedded-objects.md).

- a28b646: **Breaking:** filters use one operator vocabulary on every backend: `eq neq lt lte gt gte in between beginsWith endsWith contains exists`, with `and`, `or` and `not`.

  - Renamed: `ne` → `neq`, `le` → `lte`, `ge` → `gte`. `notContains: x` becomes `not: { <field>: { contains: x } }`, and `size` is removed. `endsWith` is new.
  - `Date`, `DateTime`, `Time` and `Timestamp` filter as dates: ranges and `between`, no substring operators.
  - `between` is typed as a pair: `[T, T]` in TypeScript, `z.tuple` in Zod.
  - Lists of scalars and enums filter with `<Type>ListFilterInput { contains: [T!], exists }`.
  - Object and interface fields filter through `<Type>FieldFilterInput { exists, where }`, to any depth. Union fields get `exists`.
  - `@readOnly` fields are filterable. `@writeOnly` fields are not, unless they are also `@filterOnly`.
  - Every `@hasMany` field takes `filter`, whatever type declares it.
  - **Ordering.** Every `@hasMany` field and list query takes `orderBy: <Target>OrderByInput`, a `{ field: asc | desc }` map. `SortDirection` is `asc`/`desc`. `@sortable` lets a field of an object type order by the object's members.

  Read more: [Filter inputs](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/models.md#filter-inputs), [Operator sets](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/models.md#operator-sets), [Ordering](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/models.md#ordering).

- a28b646: Two new built-in scalars, and stricter type hints.

  - **`SafeInt`:** an integer within `Number.isSafeInteger`, typed `number`. Zod validates it with `z.number().int()`, AppSync maps it to `Long`, and dsqlbase stores it in a `bigint` column that reads back as a `number` (the generated file imports `@dsqlbase/core` for it).
  - **`GUID`:** a global id, a model's id that also names its model. Declare `id: GUID!` on a model, or `interface Node { id: GUID! }` with Relay. `get`, `delete` and `Query.node` take the model's id type.
  - **Breaking:** a schema that declares its own `SafeInt` or `GUID`, or `Long` with `appsyncPreset`, now conflicts with the built-in.
  - **Breaking:** `@gqlbase_typehint(type:)` takes an enum literal (`type: string`). A string literal or an unknown value fails the transform instead of becoming `unknown`. A scalar can also take an `input` hint for the argument side.
  - The AppSync schema maps a custom scalar by its type hint instead of throwing. Only a scalar with an `unknown` or missing hint needs `scalarMappings`.

  Read more: [Scalars](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/scalars.md).

- a28b646: Tenancy scopes.

  - `transform.tenancy` declares scopes and their claims: `{ workspace: { default: true, claims: { workspaceId: "ID" } }, global: { claims: null } }`. `@scope(name:)` puts a stored model in a scope; the default scope applies to every stored model without one. A name that is not a declared scope throws.
  - Each claim is added to the model as a non-null `@serverOnly` field, so a relation keyed on a claim reuses it. Declare the field on the model to expose it.
  - dsqlbase exports each scope with claims as `<scope>Scope = tenantScope({...})` and its models as `<scope>Scope.table(...)`. A client derived with `$identityClaims` fills and filters the claims.
  - Generators read a model's scope with `getScope(model, context.options)`. Without `tenancy`, nothing changes.

  Read more: [Tenancy](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/tenancy.md).

- a28b646: **Breaking:** the Zod schemas follow the public schema.

  - `Create<Model>InputSchema` and `Update<Model>InputSchema` have exactly the fields of the GraphQL inputs: no `@readOnly` or `@serverOnly` fields and no relation keys. Validate `args.input`, then add the values the server sets. A model gets a schema only for the inputs it has, and nested objects reference `<Type>InputSchema`.
  - `<Type>Schema` leaves out `@serverOnly` fields, and definitions clients cannot reach get no schema. A union lists only its public members.
  - `zodSchemaGeneratorPlugin({ scalars })` sets the Zod code for a named scalar: `{ Currency: 'z.string().regex(/^[A-Z]{3}$/)' }`.

  Read more: [Zod](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/zod.md).

### Patch Changes

- Updated dependencies [a28b646]
- Updated dependencies [e656207]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
- Updated dependencies [a28b646]
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
