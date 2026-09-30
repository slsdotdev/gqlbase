# Relations

_Audience: people linking types with `@hasOne`, `@hasMany` and `@belongsTo`._

Relations are handled by `RelationsPlugin` (`packages/core/src/plugins/RelationsPlugin/RelationsPlugin.ts`, key rules in `RelationsPlugin.utils.ts` → `parseFieldRelation`), a core plugin.

```graphql
directive @hasOne(key: String) on FIELD_DEFINITION
directive @hasMany(key: String) on FIELD_DEFINITION
directive @belongsTo(key: String) on FIELD_DEFINITION
```

A relation field says "this field is resolved from another record", linked by a **key field** that holds the related record's id. The plugin adds the key field where it belongs, reshapes `@hasMany` into a list or connection, and tells the other generators (TS types, Zod, database schema, resolver types) which fields are relations. A field may carry only one relation directive.

## Where the key goes

| Directive | Cardinality | Default key | Key field is added to | Key type |
| --- | --- | --- | --- | --- |
| `@belongsTo` | one | `<field>Id` | the type declaring the field (source) | the target's `id` type |
| `@hasOne` | one | `<ParentType>Id` (camelCase) | the target type | the source's `id` type |
| `@hasMany` | many | `<ParentType>Id` (camelCase) | the target type | the source's `id` type |

- `key:` overrides the name.
- If a field with that name already exists, it is kept as declared.
- Otherwise the added key field is marked `@serverOnly @writeOnly`: it exists on the stored record, in the TS model type, in the Zod create/update schemas and in the database table, but not in the public schema or the GraphQL inputs.
- The key is nullable when the relation field is nullable (after `@semanticNonNull`), and non-null otherwise.

```graphql
type User @model {
  id: ID!
  posts: Post @hasMany            # adds Post.userId
}

type Post @model {
  id: ID!
  author: User @belongsTo         # adds Post.authorId
  editor: User @belongsTo(key: "editorUserId")
}
```

Output schema (default options):

```graphql
type User {
  id: ID!
  posts(filter: PostFilterInput): [Post!]
}

type Post {
  id: ID!
  author: User
  editor: User
}
```

`Post.userId`, `Post.authorId` and `Post.editorUserId` are present in the Zod `Create/UpdatePostInputSchema`, the `posts` table and the AppSync resolver `PostSource` type. They are absent from `schema.graphql` and `schema.types.ts`.

> **Choosing between `@hasOne` and `@belongsTo`.** Use `@belongsTo` when the current type stores the foreign key (`Post.author`). Use `@hasOne` when the *other* type stores a key pointing back (`User.profile: Profile @hasOne` puts `userId` on `Profile`).

### Fields on root types

On `Query` and `Subscription`, relation fields get no key (`key` is `null`). The relation directive only marks the field so that pagination and resolver generation treat it as a relation. `ModelPlugin` uses this for `get<Model>` (`@hasOne`) and `list<Models>` (`@hasMany`), and `NodeInterfacePlugin` uses it for `node` (`@hasOne`). `Mutation` is never processed.

### Non-model types

Relations are processed on every object and interface type, not just `@model` types. A key field is therefore added even when the source or the target is not a model.

**The type that supplies the key's type needs an `id` field:**
- for `@hasOne`/`@hasMany`, the source;
- for `@belongsTo`, the target.

Without an `id` field the transform throws ("does not have an id field"), even when `key:` is given. So a relation on an id-less namespace type (for example `type Viewer { posts: Post @hasMany }`) only works when the field is marked `@clientOnly`, which skips key placement. See [Known gaps](../internals/known-gaps.md).

The database generators only emit relations between `@model` types, and throw for anything else.

### `@clientOnly` relations

A relation field marked `@clientOnly` gets no key field. It is still reshaped (list or connection), and still counts as a relation for resolver generation.

## List shape

`@hasMany` fields are reshaped in `execute`:

| Setup | `posts: Post @hasMany` becomes | `posts: Post! @hasMany` becomes |
| --- | --- | --- |
| Default (`relay: false`) | `posts(filter: PostFilterInput): [Post!]` | `posts(filter: PostFilterInput): [Post!]!` |
| `relay: true` | `posts(filter: PostFilterInput, first: Int, after: String): PostConnection!` | the same (see [Relay](./relay.md)) |

Without Relay, a `@hasMany` becomes a plain list. The list keeps the field's own nullability, including `@semanticNonNull`, and its items are always non-null. There are no pagination arguments: `first` and `after` belong to Relay connections. A type already written as a list (`posts: [Post] @hasMany`) is left as written.

The `filter` argument is only added on `@model` types (see [Models](./models.md#where-the-filter-is-accepted)).

`@hasOne` and `@belongsTo` fields keep their declared type.

## Union and interface targets

The target must be an object, interface or union type.

- **Interface targets** are handled like objects.
- **Union targets** are accepted by the schema transform:
  - a `@hasOne`/`@hasMany` key is added to every member;
  - a `@belongsTo` key is typed from the members' `id` type, or `ID` if the members disagree.

Unions are not usable end to end yet:
- keys added to union members are always `ID!`, whatever the members' id types or the field's nullability;
- there is no discriminator (type) column;
- Zod and the mutation inputs skip union fields;
- the dsqlbase generator rejects non-model targets, and Drizzle uses the union name as if it were a table.

See [Known gaps](../internals/known-gaps.md).

## Related

- [Models](./models.md)
- [Relay](./relay.md)
- [Field visibility](./field-visibility.md)
- [dsqlbase](./dsqlbase.md), [Drizzle](./drizzle.md) — relation output
- [Known gaps](../internals/known-gaps.md)
