# @gqlbase/core

## 0.2.1

### Patch Changes

- @gqlbase/shared@0.2.1

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

- e656207: Data sources.

  - `transform.dataSources` declares named stores (`{ db: { type: "dsqlbase", default: true }, integrations: { type: "service" } }`), and `@dataSource(name:)` puts a stored model in one. A model without it is in the default source.
  - Operations, relation keys, tenancy and the public schema are the same in every source. Generators read the source with `getDataSource` and `isInDataSourceType`.
  - dsqlbase emits tables only for the source with `type: "dsqlbase"`, and throws when more than one source has that type. A relation to a model in another source keeps its key column but gets no relation; a key to a `GUID` model there is `text()`.
  - Without `dataSources`, nothing changes.

  Read more: [Data sources](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/data-sources.md).

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

- a28b646: **Breaking:** relation keys are added only between stored types, and relations to unions and interfaces have their own rules.

  - A key is added only when both ends are stored: a `@model` that is not `@clientOnly`, or a union or interface whose members all are. A relation on a plain type (`type Viewer { categories: Category @hasMany }`) is served by a resolver, keeps its shape and adds no key.
  - Keys take the target's id type. Where `GUID` is involved, a declared key must match it.
  - A declared `key:` on a relation that gets no key field must name an existing field, or the transform throws.
  - **Union and interface targets.** `@belongsTo` adds a `<field>Type` discriminator beside the key (rename it with `discriminator:`). `@hasOne` and `@hasMany` keys go on every member and are nullable, as the relation is. For an interface they go on each implementing type. Members that mix `GUID` ids with other id types throw.
  - The error for a stored relation without an `id` names the relation and the type.

  Read more: [Relations](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/relations.md), [Union and interface targets](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/relations.md#union-and-interface-targets).

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

### Patch Changes

- a28b646: Fixes.

  - **CLI:** without `--watch`, a failed transform exits with code 1. Before, it exited 0, so CI carried on with stale output.
  - **CLI:** the output directory is never read as source. The default `**/*.graphql` used to pick up `generated/schema.graphql`, so the second run failed.
  - **Watch mode:** a rebuild produces the same output as the first run (built-in scalars were typed `unknown` after the first). The watcher ignores the output directory and runs only for GraphQL files.
  - **CLI:** a config file that fails to load reports the real error, with its cause, instead of "No configuration file found". A missing `--config` path is named. `-c` and `-o` require a value.
  - The source can reference generated types such as `StringFilterInput` or `<Model>Connection`. A misspelled type reports "Unknown type".
  - `@constraint` is removed from input fields and arguments in the output schema.
  - A non-model object type that refers to itself no longer overflows the stack in mutation inputs.
  - Source files are joined with a newline, so a file without a trailing newline no longer fuses with the next one.
  - Generated TypeScript uses LF line endings, and every generated file imports `../schema.types.js` with its extension.

  Read more: [Configuration](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/configuration.md).

- Updated dependencies [a28b646]
  - @gqlbase/shared@0.2.0

## 0.1.11

### Patch Changes

- @gqlbase/shared@0.1.11

## 0.1.10

### Patch Changes

- @gqlbase/shared@0.1.10

## 0.1.9

### Patch Changes

- @gqlbase/shared@0.1.9

## 0.1.8

### Patch Changes

- @gqlbase/shared@0.1.8

## 0.1.7

### Patch Changes

- @gqlbase/shared@0.1.7

## 0.1.6

### Patch Changes

- 18da481: Update deps
- Updated dependencies [18da481]
  - @gqlbase/shared@0.1.6

## 0.1.5

### Patch Changes

- @gqlbase/shared@0.1.5

## 0.1.4

### Patch Changes

- @gqlbase/shared@0.1.4

## 0.1.3

### Patch Changes

- @gqlbase/shared@0.1.3

## 0.1.2

### Patch Changes

- feca490: Added `@belongsTo` on RelationsPlugin
  - @gqlbase/shared@0.1.2

## 0.1.1

### Patch Changes

- @gqlbase/shared@0.1.1

## 0.1.0

### Minor Changes

- 24f07c8: Transformer outputs file contents rather than write to fs.

### Patch Changes

- Updated dependencies [24f07c8]
  - @gqlbase/shared@0.1.0

## 0.0.10

### Patch Changes

- cbd7391: Update dependencies
- Updated dependencies [cbd7391]
  - @gqlbase/shared@0.0.10

## 0.0.9

### Patch Changes

- Updated dependencies [ec95c9c]
  - @gqlbase/shared@0.0.9

## 0.0.8

### Patch Changes

- @gqlbase/shared@0.0.8

## 0.0.7

### Patch Changes

- 309082b: Update definition methods
  - @gqlbase/shared@0.0.7

## 0.0.6

### Patch Changes

- dc22a95: Add README files for all packages
- Updated dependencies [dc22a95]
  - @gqlbase/shared@0.0.6

## 0.0.5

### Patch Changes

- @gqlbase/shared@0.0.5

## 0.0.4

### Patch Changes

- @gqlbase/shared@0.0.4

## 0.0.3

### Patch Changes

- 52f4e5d: cli package
- fbc977e: Added shared package
- d09d42e: transformer base implementation
- 710da2f: core definition modules
- 68109c1: feat(plugins): added ModelPlugin
- 4cbe6d8: feat: plugin factory
- Updated dependencies [fbc977e]
- Updated dependencies [68109c1]
  - @gqlbase/shared@0.0.2

## 0.0.2

### Patch Changes

- 7dac1e9: Added base interfaces

## 0.0.1

### Patch Changes

- 7a643c4: Initial commit
