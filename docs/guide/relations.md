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
- Otherwise the added key field is marked `@serverOnly @writeOnly`: it exists on the stored record, in the TS model type and in the database table, but not in the public schema, the GraphQL inputs or the Zod schemas.
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
  posts(filter: PostFilterInput, orderBy: PostOrderByInput): [Post!]
}

type Post {
  id: ID!
  author: User
  editor: User
}
```

`Post.userId`, `Post.authorId` and `Post.editorUserId` are present in the `posts` table and the AppSync resolver `PostSource` type. They are absent from `schema.graphql`, `schema.types.ts` and the Zod schemas.

> **Choosing between `@hasOne` and `@belongsTo`.** Use `@belongsTo` when the current type stores the foreign key (`Post.author`). Use `@hasOne` when the *other* type stores a key pointing back (`User.profile: Profile @hasOne` puts `userId` on `Profile`).

### Fields on root types

On `Query` and `Subscription`, relation fields get no key (`key` is `null`). The relation directive only marks the field so that pagination and resolver generation treat it as a relation. `ModelPlugin` uses this for `get<Model>` (`@hasOne`) and `list<Models>` (`@hasMany`), and `NodeInterfacePlugin` uses it for `node` (`@hasOne`). `Mutation` is never processed.

### Keys only between stored types

A key is a stored column pointing at a stored row, so it is added only when **both ends are stored types**: a `@model` that is not `@clientOnly`. An interface or a union counts as stored when every type implementing it, or every member, is stored.

Any other relation is served by a resolver. It gets no key field, but keeps its list or connection shape and its arguments, and still counts as a relation for resolver generation.

| Source → target | Key |
| --- | --- |
| `@model` → `@model` | yes |
| root type (`Query`) → anything | no |
| plain type, with or without an `id` (`Viewer`) → `@model` | no |
| `@clientOnly` type → `@model` | no |
| `@model` → `@clientOnly` type or plain type | no |

```graphql
type Viewer {
  categories: Category @hasMany # no key on Category: a resolver lists them
}

extend type Query {
  viewer: Viewer!
}
```

When both ends are stored, the type that supplies the key's type needs an `id` field:
- for `@hasOne`/`@hasMany`, the source;
- for `@belongsTo`, the target.

Without one the transform throws, naming the relation and the type ("Relation Log.entries needs the id of Log for its key, but Log has no id field."), even when `key:` is given.

### `@clientOnly` relations

A relation field marked `@clientOnly` gets no key field, whatever its ends. It is still reshaped (list or connection), and still counts as a relation for resolver generation.

### `key:` on a relation without a key

A relation that gets no key field (not between two stored types, or `@clientOnly`) can still declare `key:`: the field its resolver queries by. It is not added, since a plain parent has no `id` to type it with, so **it must exist** on the type that would hold it: the target for `@hasOne`/`@hasMany`, every member of a union target, or the type declaring a `@belongsTo`. Otherwise the transform throws ("Viewer.orders declares key "userId", but Order has no field userId."). The check runs after every type is normalized, so a key another relation adds counts.

```graphql
type Viewer {
  orders: Order @hasMany(key: "userId") # Order must have userId, declared or added by User.orders
}
```

### In the generated types

A relation is resolved by its own resolver, so it is optional in every generated type, even when the schema field is non-null. The schema types keep relations apart from the type's own fields: `children: CategoryConnection!` is `children?: CategoryConnectionFull` in `CategoryRelations`, not in `CategoryOwnFields` (see [Configuration → Schema types](./configuration.md#schema-types)).

## List shape

`@hasMany` fields are reshaped in `execute`:

| Setup | `posts: Post @hasMany` becomes | `posts: Post! @hasMany` becomes |
| --- | --- | --- |
| Default (`relay: false`) | `posts(filter: PostFilterInput, orderBy: PostOrderByInput): [Post!]` | `posts(filter: …, orderBy: …): [Post!]!` |
| `relay: true` | `posts(filter: PostFilterInput, orderBy: PostOrderByInput, first: Int, after: String): PostConnection!` | the same (see [Relay](./relay.md)) |

Without Relay, a `@hasMany` becomes a plain list. The list keeps the field's own nullability, including `@semanticNonNull`, and its items are always non-null. There are no pagination arguments: `first` and `after` belong to Relay connections. A type already written as a list (`posts: [Post] @hasMany`) is left as written.

Every `@hasMany` gets the `filter` and `orderBy` arguments, whatever its parent type (see [Models](./models.md#where-the-filter-is-accepted) and [Ordering](./models.md#ordering)).

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
