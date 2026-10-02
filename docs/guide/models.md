# Models

_Audience: people defining `@model` types and using the generated operations, inputs and filters._

`@model` is handled by `ModelPlugin` (`packages/core/src/plugins/ModelPlugin/ModelPlugin.ts`), a core plugin.

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

becomes (with the default operations):

```graphql
type Post {
  id: ID!
  title: String!
  content: String
}

type Query {
  getPost(id: ID!): Post
  listPosts(filter: PostFilterInput): [Post!]
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

With the `relay` option on, `listPosts` returns `PostConnection!` and gains `first`/`after` (see [Relay](./relay.md)).

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

**Defaults.** The default is `["read", "write"]`, set through the `operations` [transformer option](./configuration.md#transformer-options). The option uses the lowercase names:

```js
defineConfig({ transform: { operations: ["write"] } }); // models get create/update/delete only
```

**Per model.** The directive argument uses the enum values, which are the uppercase keys: `READ`, `WRITE`, `GET`, `LIST`, `CREATE`, `UPDATE`, `UPSERT`, `DELETE`. When the argument is present it replaces the default. An empty list generates no operations.

```graphql
type AuditLog @model(operations: [LIST]) { … }
type Setting @model(operations: []) { … }   # a model with no root operations
```

**Type-level visibility.** A `@serverOnly` model gets no operations at all, and a `@clientOnly` model gets only `get` and `list` of those configured (see [Field visibility](./field-visibility.md#on-an-object-type)).

If a field with the generated name already exists on `Query` or `Mutation`, it is left alone. For `list`, a missing `filter` argument is still added to it.

## Mutation inputs

Which fields appear in which input is decided by `packages/core/src/plugins/ModelPlugin/ModelPlugin.utils.ts` (`shouldSkipFieldFrom*`). Summary; the full matrix is in [Field visibility](./field-visibility.md):

- **Always skipped:** `@readOnly`, `@serverOnly`, `@clientOnly` and relation fields (`@hasOne`, `@hasMany`, `@belongsTo`).
- `@createOnly` fields appear only in the create input, `@updateOnly` only in update/upsert, `@filterOnly` only in the filter input.
- **`id`:** optional in create (`id: ID`), required in update, upsert and delete.
- **Nullability:** the create input keeps the field's nullability (honouring `@semanticNonNull`); update and upsert make every field except `id` nullable.
- **Scalars and enums** are copied with their list shape.
- **Fields whose type is another `@model`** are skipped. Use a relation and its key instead.
- **Fields whose type is a non-model object** get a generated `<Type>Input`, built recursively from the object's fields, and are referenced from the model input. An existing type with that name is reused as is.
- **One `<Type>Input` for every operation.** The nested input is built once, with the rules of the first operation that reaches it (the create rules, in practice), and every operation reuses it, so the update input carries the create input's non-null fields. This is by design: a non-model object is stored as one JSON value, so a write replaces it whole (a put, not a patch), and the whole value has to be valid.
- **Union and interface fields** are skipped silently.

### Partial updates and `null`

Update inputs are partial: an omitted field is left unchanged, and `null` sets a field to null. Because every update field is nullable, GraphQL also accepts `null` for a field that is required, such as `name: String @semanticNonNull`. The input type cannot say "optional but not null". Whether a `null` is allowed is decided by validation, not by the input type:

- Validate the update with the generated `Update<Model>InputSchema` ([Zod](./zod.md)). A required field is `.optional()`, so `null` is rejected with an error the client sees. A nullable field is `.nullable().optional()`, so `null` clears it.
- Do not drop `null` values in the resolver. The resolver cannot tell "clear this" from "ignore this", and silently skipping a write hides a client bug.

`Create<Model>InputSchema` describes the stored row, so validate the row the resolver is about to write: the client input plus server-set fields such as timestamps. This also enforces `@constraint`. `example/src/resolvers/category.ts` shows both.

## Filter inputs

Filters are handled by `FilterPlugin` (`packages/core/src/plugins/FilterPlugin/FilterPlugin.ts`), a core plugin. `<Type>FilterInput` is created for the target of every `@hasMany` field, including the `list<Models>` queries. It contains one entry per filterable field plus `and`, `or` and `not`.

**Skipped fields:**
- everything skipped from inputs (`@readOnly`, `@serverOnly`, `@clientOnly`, relations);
- `@writeOnly`, `@createOnly` or `@updateOnly` fields not also marked `@filterOnly`;
- lists of objects, interfaces or unions.

### Operator sets

One operator vocabulary is used on every model, whatever its backend. The names are dsqlbase's, so a filter is a valid dsqlbase `where`; other backends translate it (see [AppSync](./appsync.md)). The operator lists live in `FilterPlugin.utils.ts` (`FilterOperators`).

The built-in inputs are added in `before()`: `IDFilterInput`, `StringFilterInput`, `IntFilterInput`, `FloatFilterInput` and `BooleanFilterInput`.

| Kind | Used for | Operators |
| --- | --- | --- |
| ID-like | `ID`, scalars hinted `id` (e.g. `UUID`) | `eq` `neq` `in` `exists` |
| String-like | `String`, scalars hinted `string` (`EmailAddress`, `URL`, …) | `eq` `neq` `lt` `lte` `gt` `gte` `in` `between` `beginsWith` `endsWith` `contains` `exists` |
| Number-like | `Int`, `Float`, scalars hinted `number` (`SafeInt`) | `eq` `neq` `lt` `lte` `gt` `gte` `in` `between` `exists` |
| Date-like | `Date`, `DateTime`, `Time`, `Timestamp`, by name | `eq` `neq` `lt` `lte` `gt` `gte` `in` `between` `exists` |
| Boolean-like | `Boolean`; scalars hinted `boolean`, `object` or `unknown` (with a warning) | `eq` `neq` `exists` |
| Enum | every enum, as `<Enum>FilterInput` | `eq` `neq` `in` `exists` |
| List | every list of scalars or enums, as `<Type>ListFilterInput` (`[String]` → `StringListFilterInput`) | `contains` `exists` |

- `in` and `between` take `[T!]`; `between` takes two values, low then high, both included. A month is `{ between: ["2026-09-01", "2026-09-30"] }` on a `Date`.
- `exists: true` matches a set value, `exists: false` a missing or `null` one.
- `and` and `or` take `[<Type>FilterInput!]`; `not` takes `<Type>FilterInput`. Conditions on several fields of one filter are combined with `and`.
- To exclude a substring, use `not`: `{ not: { name: { contains: "p" } } }`.
- Custom scalars get their own `<Scalar>FilterInput`, shaped by their [type hint](./scalars.md).
- A `<Type>FilterInput` declared in the source is used as is.

### Object fields

A field typed as an object or interface is filtered through `<Type>FieldFilterInput`: `exists` on the value itself, and `where` on its members. Operators on the object itself sit beside `where`, so a member named like an operator is never ambiguous.

```graphql
input ProductFilterInput {
  status: ProductStatusFilterInput
  pricingModel: PricingModelFieldFilterInput
  and: [ProductFilterInput!]
  or: [ProductFilterInput!]
  not: ProductFilterInput
}

input PricingModelFieldFilterInput {
  exists: Boolean
  where: PricingModelFilterInput
}

input PricingModelFilterInput {
  amount: FloatFilterInput
  currency: StringFilterInput
  and: [PricingModelFilterInput!]
  or: [PricingModelFilterInput!]
  not: PricingModelFilterInput
}
```

```graphql
{ status: { eq: ACTIVE }, pricingModel: { where: { amount: { lte: 50 } } } }
```

- `where` follows the same rules as a model's filter, with its own `and`, `or` and `not`, to any depth. A type that refers to itself reuses its filter.
- A union field gets `exists` only: its members share no fields.
- Lists of objects are not filterable. See [Known gaps](../internals/known-gaps.md).
- dsqlbase 0.1.6 cannot run a nested `where` yet (see [dsqlbase](./dsqlbase.md)).

#### Migrating from the 0.1 operators

0.2 renames the operators and removes the ones no backend shared. Update client operations:

| 0.1 | 0.2 |
| --- | --- |
| `ne` | `neq` |
| `le` | `lte` |
| `ge` | `gte` |
| `notContains: x` | `not: { <field>: { contains: x } }` |
| `size` (and `SizeFilterInput`) | removed |
| a list of a built-in scalar filtered with the element's filter (`tags: StringFilterInput`) | `tags: StringListFilterInput` (`contains`, `exists`) |
| `and: [XFilterInput]`, `or: [XFilterInput]` | `[XFilterInput!]` |

`eq`, `lt`, `gt`, `in`, `between`, `beginsWith`, `contains` and `exists` are unchanged. `endsWith` is new.

### Where the filter is accepted

Every `@hasMany` field gets `filter: <Target>FilterInput`, whatever its parent type:
- `list<Models>(filter:)` on `Query`;
- `@hasMany` fields on models;
- `@hasMany` fields on types that are not stored, such as a `Viewer` (see [Relations → Keys only between stored types](./relations.md#keys-only-between-stored-types));
- `@hasMany` fields declared on `Query`.

Sorting is not generated: there is no `orderBy` argument.

## Referencing generated types

The source may use the types plugins generate: the scalar filter inputs (`StringFilterInput`, `IntFilterInput`, …), `<Model>FilterInput`, `Create<Model>Input` / `Update<Model>Input`, and with Relay, `<Model>Connection`, `<Model>Edge`, `PageInfo` and `Node`.

```graphql
extend type Query {
  searchCategories(name: StringFilterInput!, first: Int, after: String): CategoryConnection!
}
```

Unknown type names are checked once `execute` has run, when every generated type exists; a name nothing declares or generates still fails with "Unknown type". To change a generated type, declare it yourself: plugins skip a name that already exists, so `input StringFilterInput { … }` in the source replaces the generated one.

## Nullability and `@semanticNonNull`

With the `semanticNullability` transformer option on ([Configuration](./configuration.md#transformer-options)), core registers `RfcFeaturesPlugin`, which declares the draft-RFC directive. With it off (the default), the directive is not declared and a schema that uses it fails validation.

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
