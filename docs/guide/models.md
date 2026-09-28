# Models

_Audience: people defining `@model` types and using the generated operations, inputs and filters._

`@model` is handled by `ModelPlugin` (`packages/plugins/src/base/ModelPlugin/ModelPlugin.ts`), part of `basePreset()`.

```graphql
directive @model(operations: [ModelOperation!]) on OBJECT
```

A model is an object type backed by a record store. For each model the plugin adds root operations, mutation inputs and a filter input. The directive and the `ModelOperation` enum are removed from the output schema.

## Example

```graphql
type Post @model {
  id: ID!
  title: String!
  content: String
}
```

becomes (with `basePreset()` defaults):

```graphql
type Post {
  id: ID!
  title: String!
  content: String
}

type Query {
  getPost(id: ID!): Post
  listPosts(filter: PostFilterInput): [Post]
}

type Mutation {
  createPost(input: CreatePostInput!): Post
  updatePost(input: UpdatePostInput!): Post
  deletePost(id: ID!): Post
}

input PostFilterInput {
  id: IDFilterInput
  title: StringFilterInput
  content: StringFilterInput
  and: [PostFilterInput]
  or: [PostFilterInput]
  not: PostFilterInput
}

input CreatePostInput {
  id: ID
  title: String!
  content: String
}

input UpdatePostInput {
  id: ID!
  title: String
  content: String
}
```

With `relayPreset()`, `listPosts` returns `PostConnection!` and gains `first`/`after` (see [Relay](./relay.md)).

## Operations

| Operation | Generated field | Notes |
| --- | --- | --- |
| `get` | `Query.get<Model>(id: ID!): <Model>` | |
| `list` | `Query.list<Models>(filter: <Model>FilterInput): [<Model>]` | Name is pluralized. The field is marked as a `@hasMany` relation internally, so Relay turns it into a connection. |
| `create` | `Mutation.create<Model>(input: Create<Model>Input!): <Model>` | |
| `update` | `Mutation.update<Model>(input: Update<Model>Input!): <Model>` | |
| `upsert` | `Mutation.upsert<Model>(input: Upsert<Model>Input!): <Model>` | Opt-in only; not part of `write`. The input follows the update rules. |
| `delete` | `Mutation.delete<Model>(id: ID!): <Model>` | |

Shorthands: `read` = `get` + `list`; `write` = `create` + `update` + `delete`.

**Defaults.** The plugin-level default is `["read", "write"]`, set through `basePreset({ operations })`. Plugin options use the lowercase names:

```js
basePreset({ operations: ["write"] }); // models get create/update/delete only
```

**Per model.** The directive argument uses the enum values, which are the uppercase keys: `READ`, `WRITE`, `GET`, `LIST`, `CREATE`, `UPDATE`, `UPSERT`, `DELETE`. When the argument is present it replaces the default. An empty list generates no operations.

```graphql
type AuditLog @model(operations: [LIST]) { … }
type Setting @model(operations: []) { … }   # a model with no root operations
```

If a field with the generated name already exists on `Query` or `Mutation`, it is left alone. For `list`, a missing `filter` argument is still added to it.

## Mutation inputs

Which fields appear in which input is decided by `packages/plugins/src/base/ModelPlugin/ModelPlugin.utils.ts` (`shouldSkipFieldFrom*`). Summary; the full matrix is in [Field visibility](./field-visibility.md):

- **Always skipped:** `@readOnly`, `@serverOnly`, `@clientOnly` and relation fields (`@hasOne`, `@hasMany`, `@belongsTo`).
- `@createOnly` fields appear only in the create input, `@updateOnly` only in update/upsert, `@filterOnly` only in the filter input.
- **`id`:** optional in create (`id: ID`), required in update, upsert and delete.
- **Nullability:** the create input keeps the field's nullability (honouring `@semanticNonNull`); update and upsert make every field except `id` nullable.
- **Scalars and enums** are copied with their list shape.
- **Fields whose type is another `@model`** are skipped. Use a relation and its key instead.
- **Fields whose type is a non-model object** get a generated `<Type>Input`, built recursively from the object's fields, and are referenced from the model input. An existing type with that name is reused as is.
- **Union and interface fields** are skipped silently.

> **Nested object inputs are shared.** `<Type>Input` is created once, using the rules of whichever operation reaches it first, and then reused by every model and operation. In practice this means the create rules, with non-null fields staying non-null in the update input too. See [Known gaps](../internals/known-gaps.md).

## Filter inputs

`<Model>FilterInput` is created when the model has the `list` operation, or when it is the target of a `@hasMany` field on a model. It contains one entry per filterable field plus `and`, `or` and `not`.

**Skipped fields:**
- everything skipped from inputs (`@readOnly`, `@serverOnly`, `@clientOnly`, relations);
- `@createOnly` or `@updateOnly` fields not also marked `@filterOnly`;
- fields whose type is an object, interface or union. Non-model object fields, unions and interfaces cannot be filtered.

`@writeOnly` fields are **not** skipped.

### Operator sets

The built-in inputs are added in `before()`: `IDFilterInput`, `StringFilterInput`, `IntFilterInput`, `FloatFilterInput`, `BooleanFilterInput`, `SizeFilterInput`, and an enum `SortDirection { ASC DESC }`. Nothing references `SortDirection` yet.

| Kind | Used for | Operators |
| --- | --- | --- |
| ID-like | `ID`, scalars hinted `id` (e.g. `UUID`) | `ne` `eq` `in` `exists` |
| String-like | `String`, scalars hinted `string` (`DateTime`, `Date`, `EmailAddress`, …) | `ne` `eq` `le` `lt` `ge` `gt` `in` `contains` `notContains` `between` `beginsWith` `exists` `size` |
| Number-like | `Int`, `Float`, scalars hinted `number` (`Timestamp`) | `ne` `eq` `le` `lt` `ge` `gt` `in` `between` `exists` |
| Boolean-like | `Boolean`; scalars hinted `boolean`, `object` or `unknown` (with a warning) | `ne` `eq` `exists` |
| Enum | every enum, as `<Enum>FilterInput` | `eq` `ne` `in` `exists` |
| List | lists of custom scalars or enums, as `<Type>ListFilterInput` | `contains` `notContains` `size` |
| Size | the `size` operand | `ne` `eq` `le` `lt` `ge` `gt` `between` (all `Int`) |

`in` and `between` take `[T!]`. `exists` takes `Boolean`. Custom scalars get their own `<Scalar>FilterInput`, shaped by their [type hint](./scalars.md).

> **Two list quirks.**
> - A list of a built-in scalar (for example `tags: [String]`) gets the element's filter (`StringFilterInput`), not a list filter.
> - A list of a custom scalar or enum only gets `<Type>ListFilterInput` when no `<Type>FilterInput` exists yet. Otherwise it reuses the element filter.
>
> See [Known gaps](../internals/known-gaps.md).

### Where the filter is accepted

- `list<Models>(filter:)` on `Query`.
- Every `@hasMany` field **on a `@model` type** gets `filter: <Target>FilterInput`. A `@hasMany` on a non-model type (for example a root `Viewer` type) gets no `filter` argument.

Sorting is not generated: there is no `orderBy` argument.

## Nullability and `@semanticNonNull`

`basePreset()` includes `RfcFeaturesPlugin`, which declares the draft-RFC directive:

```graphql
directive @semanticNonNull(levels: [Int!]! = [0]) on FIELD_DEFINITION
```

A field marked `@semanticNonNull` is nullable in the schema (so errors can still null it out) but is treated as non-null by gqlbase's generators:
- required in create inputs;
- a non-optional property in TypeScript types;
- no `.nullable()` in Zod;
- `.notNull()` in database columns.

`levels` addresses list depth: `0` is the field itself, `1` the list items, and so on. The directive stays in the output `schema.graphql` (the AppSync schema drops it).

```graphql
type User @model {
  id: ID!
  name: String @semanticNonNull
  tags: [String] @semanticNonNull(levels: [0, 1])
}
```

## Interfaces

`InterfaceUtilsPlugin` copies fields from implemented interfaces into each implementor, and adds transitively implemented interfaces. If a field is redeclared with a different type, it logs a warning and uses the interface's type. So a `@model` implementing an interface gets the interface's fields in all of its generated inputs.

## Related

- [Relations](./relations.md)
- [Field visibility](./field-visibility.md)
- [Scalars](./scalars.md)
- [Relay](./relay.md)
- [Known gaps](../internals/known-gaps.md)
