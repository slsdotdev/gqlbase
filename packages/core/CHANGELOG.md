# @gqlbase/core

## 0.2.0

### Minor Changes

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

- e656207: Data sources: the `transform.dataSources` option declares named stores (`{ db: { type: "dsqlbase", default: true }, integrations: { type: "service" } }`), and `@dataSource(name: DataSource!)` puts a stored model in one; a model without it is in the default source. Core only records the source: capability plugins read it with `getDataSource` / `isInDataSourceType` and generate the models of the source types they handle. Operations, relation keys, tenancy and the public schema do not change. Without `dataSources`, nothing changes.

  Docs: docs/guide/data-sources.md, docs/guide/configuration.md#transformer-options

- 5328484: `Date`, `DateTime`, `Time` and `Timestamp` get their own filter kind: `eq neq lt lte gt gte in between exists`. `Date`/`DateTime`/`Time` lose the string operators (`beginsWith`, `endsWith`, `contains`); month scoping is `{ between: ["2026-09-01", "2026-09-30"] }`.

  Docs: docs/guide/models.md#operator-sets, docs/guide/scalars.md

- 5328484: Every `@hasMany` field gets the `filter` argument, whatever its parent type: a `Viewer` or a field declared on `Query` now gets `filter: <Target>FilterInput` like a model does. Filter inputs move from `ModelPlugin` to a new core plugin, `FilterPlugin`, registered after `ModelPlugin`.

  Docs: docs/guide/models.md, docs/guide/relations.md, docs/guide/relay.md, docs/guide/configuration.md

- 5328484: **Breaking:** filter inputs use one operator vocabulary, dsqlbase's, on every backend: `eq neq lt lte gt gte in between beginsWith endsWith contains exists`, plus `and`/`or`/`not`. Migrate client operations:

  | 0.1                                                            | 0.2                                            |
  | -------------------------------------------------------------- | ---------------------------------------------- |
  | `ne`                                                           | `neq`                                          |
  | `le`                                                           | `lte`                                          |
  | `ge`                                                           | `gte`                                          |
  | `notContains: x`                                               | `not: { <field>: { contains: x } }`            |
  | `size`, `SizeFilterInput`                                      | removed                                        |
  | a list of a built-in scalar filtered with the element's filter | `<Type>ListFilterInput` (`contains`, `exists`) |
  | `and`/`or: [XFilterInput]`                                     | `[XFilterInput!]`                              |

  `endsWith` is new on string-like filters. Every list of scalars or enums gets `<Type>ListFilterInput`, including lists of built-in scalars.

  Docs: docs/guide/models.md#operator-sets, docs/guide/dsqlbase.md

- 5328484: Object and interface fields are filterable through `<Type>FieldFilterInput { exists, where: <Type>FilterInput }`, for example `{ pricingModel: { where: { amount: { lte: 50 } } } }`. `where` has its own `and`/`or`/`not`, to any depth. Union fields get `exists` only; lists of objects are still left out.

  Docs: docs/guide/models.md#object-fields, docs/guide/dsqlbase.md

- 5328484: Every `@hasMany` field, including `list<Models>`, gets `orderBy: <Target>OrderByInput`, a `{ <field>: SortDirection }` map over the target's sortable fields (non-list scalars and enums the filter accepts). `SortDirection` is now `enum SortDirection { asc desc }` (was `ASC DESC`, unused). The value passes to dsqlbase's `orderBy`. GraphQL does not keep an input object's key order, so priority follows the order the input type declares its fields. With `generateArgumentSchemas`, Zod emits the `orderBy` inputs too.

  Docs: docs/guide/models.md#ordering, docs/guide/relations.md, docs/guide/relay.md, docs/guide/zod.md

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

- 5328484: `@readOnly` fields are filterable: `@readOnly` stops writes, not reads, so `createdAt: DateTime @readOnly` now appears in `<Model>FilterInput`. Before, it was left out even with `@filterOnly`.

  Docs: docs/guide/field-visibility.md, docs/guide/models.md#filter-inputs

- 512c76e: A relation that gets no key field (not between two stored types, or `@clientOnly`) checks a declared `key:`: the field must exist on the type that would hold it, or the transform throws. It was silently ignored.

  Docs: docs/guide/relations.md

- 5328484: Relation keys are added only between stored types: a `@model` that is not `@clientOnly` (an interface or union counts when all its implementations or members do). A relation on a plain type such as `type Viewer { categories: Category @hasMany }` no longer throws for a missing `id` and no longer adds an unfillable key to the target: it is served by a resolver and keeps its list or connection shape. A schema that relied on keys to or from non-model types loses them. The error for a stored relation without an `id` now names the relation and the type that lacks it.

  Docs: docs/guide/relations.md

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

- a34bc19: Tenancy scopes. The `transform.tenancy` option declares scopes and their claims, `{ workspace: { default: true, claims: { workspaceId: "ID" } }, global: { claims: null } }`, and registers the core `TenancyPlugin`. `@scope(name: TenancyScope!)` puts a stored model in a scope, and the default scope applies to every stored model without one. Each claim is added to the model as a non-null `@serverOnly` field, before other plugins normalize, so a relation keyed on a claim reuses it. A model can declare the claim field itself to expose it, with the claim's type and non-null. The config is validated when the transformer is created. Generators read a model's scope with `getScope(model, context.options)`. Without `tenancy`, nothing changes.

  Docs: docs/guide/tenancy.md, docs/decisions/0005-tenancy-scopes.md, docs/guide/configuration.md#transformer-options, docs/guide/field-visibility.md, docs/internals/architecture.md, docs/internals/plugin-api.md

- af89b97: Add transformer options `relay`, `semanticNullability` and `operations`, set under `transform` in the config (next to `plugins`) or at the top level of `createTransformer`, and frozen onto `context.options`. `ModelPlugin` reads `operations` from the context. `RfcFeaturesPlugin`, which declares `@semanticNonNull`, is registered only when `semanticNullability: true`; the default is `false`, so a config whose schema uses the directive must set it.

  Docs: docs/guide/configuration.md, docs/guide/models.md, docs/guide/relay.md, docs/internals/plugin-api.md

- af89b97: `@serverOnly` and `@clientOnly` can mark an object type. A field whose type is such an object inherits the directive.
  - `@serverOnly` type: removed from the output schema, the schema types and the AppSync types (also as a `Node` implementor), but still stored. A `@serverOnly @model` keeps its table and Zod row schemas and gets no operations.
  - `@clientOnly` type: in the output schema, never stored. A `@clientOnly @model` gets only its configured read operations (`get`, `list`), no table and no Zod create/update schemas.

  The dsqlbase generator now emits `$enum` only for enums a column uses, instead of every enum in the document.

  Docs: docs/guide/field-visibility.md, docs/guide/models.md, docs/guide/dsqlbase.md, docs/guide/zod.md, docs/guide/README.md

### Patch Changes

- c186041: `extend` of an undeclared type no longer disappears silently. `extend type Query`, `Mutation` or `Subscription` with no declaration creates the root type (plugins then add their operations to it). Any other extension of an undeclared type, or an extension whose kind does not match the declaration, throws `InvalidDefinitionError` naming the type. A schema that now throws was already losing that extension.

  Docs: docs/guide/configuration.md, docs/internals/known-gaps.md

- c186041: Correct the `RelationsPlugin` docstring: `@hasOne` and `@hasMany` put the key on the target, `@belongsTo` on the source. Document that a nested `<Type>Input` is shared across create and update by design (a non-model object is stored as one JSON value, so writes replace it whole).

  Docs: docs/guide/relations.md, docs/guide/models.md, docs/internals/known-gaps.md

- e656207: `@scope(name:)` with a name that is not a declared tenancy scope now throws. It was accepted and the model was left in no scope, because SDL validation does not check argument values.

  Docs: docs/guide/tenancy.md#scope

- 5328484: A non-model object type that refers to itself (`type PricingModel { floor: PricingModel }`) no longer overflows the stack when it is used in a model's mutation inputs: the nested reference reuses `PricingModelInput`.

  Docs: none, no documented behaviour changes.

- c186041: The source can reference generated types, such as `StringFilterInput`, `<Model>FilterInput` or `<Model>Connection`. Validation now runs in stages: right after the merge without the known-type-names rule, fully once `execute` has run (so an unknown type still fails, before any generator runs), and on the final document (so a plugin that leaves invalid SDL fails loudly). Transforming plugins skip a type reference they cannot resolve and leave it to validation, so a typo reports "Unknown type" instead of a plugin error. `DocumentNode.validate` takes an optional list of SDL rules.

  `@constraint` is now removed from input fields and arguments too, not only from object fields, so the printed schema no longer has dangling `@constraint` usages.

  Docs: docs/internals/architecture.md, docs/guide/models.md#referencing-generated-types, docs/guide/field-visibility.md, docs/internals/known-gaps.md

- c186041: `@gqlbase_typehint(type:)` is declared as `TypeHint!`, and a string literal (`type: "string"`) or an unknown value now fails the transform with an error naming the scalar, instead of silently becoming `unknown`. Fixed the `getTypeHint` docstring (the default is `"unknown"`) and the `TypeHint` list in the plugin docstring (adds `object`).

  Docs: docs/guide/scalars.md, docs/internals/known-gaps.md

- c186041: `@writeOnly` fields are no longer in `<Model>FilterInput`, since clients cannot filter on a value they cannot read. Add `@filterOnly` to a `@writeOnly` field to keep it in the filter.

  Docs: docs/guide/field-visibility.md, docs/internals/known-gaps.md

- Updated dependencies [c186041]
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
