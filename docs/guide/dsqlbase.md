# dsqlbase

_Audience: people generating a [dsqlbase](https://github.com/slsdotdev/dsqlbase) schema (Aurora DSQL ORM) from their `@model` types._

```js
import { dsqlbase } from "@gqlbase/plugins/dsql";

plugins: [basePreset(), relayPreset(), dsqlbase()];
```

`dsqlbase()` returns `[dsqlbaseSchemaGeneratorPlugin()]`. The plugin is `DsqlBaseSchemaGeneratorPlugin` (`packages/plugins/src/dsql/DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.ts`). It writes `dsqlbase.schema.ts`, which imports builders from `dsqlbase/schema` and model types from `./models.typegen.js`.

## Options

The plugin accepts `emitOutput` (return the content as `output.dsqlBaseSchema`) and `scalarMap` (`Record<string, { type, dataType, options? }>`, where `dataType` is the dsqlbase column builder name, for example `numeric`).

`dsqlbase()` passes no options, and `@gqlbase/plugins/dsql` exports only `dsqlbase`. So these options cannot be set from a config file today. See [Known gaps](../internals/known-gaps.md).

## What is generated

```graphql
enum Status { OPEN CLOSED }

type User @model {
  id: ID!
  name: String!
  status: Status
  tags: [String]
  address: Address
  posts: Post @hasMany
}

type Address { city: String! zip: String }

type Post @model {
  id: ID!
  title: String!
  author: User @belongsTo
}
```

```ts
import { $enum, table, uuid, text, json, hasMany, belongsTo, relations } from "dsqlbase/schema";
import { type Status, type Address } from "./models.typegen.js";

export const statusEnum = $enum("status_enum", ["OPEN", "CLOSED"]);

export const users = table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: statusEnum.column("status"),
  tags: json("tags").$type<string[]>(),
  address: json("address").$type<Address>(),
});

export const posts = table("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  userId: uuid("user_id"),
  authorId: uuid("author_id"),
});

export const userRelations = relations(users, {
  posts: hasMany(posts, { from: [users.columns.id], to: [posts.columns.userId] }),
});

export const postRelations = relations(posts, {
  author: belongsTo(users, { from: [posts.columns.authorId], to: [users.columns.id] }),
});
```

### Rules

- **Tables.** Every `@model` object becomes `table("<snake_plural>", {...})`, exported as `<camelPlural>`. Non-model types produce no table.
- **Columns.** Every field except `@gqlbase_internal`, `@clientOnly` and relation fields. `@serverOnly`, `@writeOnly` and `@readOnly` fields, and relation keys, are all columns. Column names are `snake_case` of the field name.
- **`id`.** Always `.primaryKey().defaultRandom()`, whatever its type.
- **Not null.** `.notNull()` when the field is non-null or `@semanticNonNull`.
- **Scalars.** Mapped as in [Scalars](./scalars.md): `ID` → `uuid`, `String` → `text`, `Int` → `int`, `Float` → `real`, `Boolean` → `bool`, `DateTime` → `timestamp(…, { mode: "iso" })`, … Custom scalars use `scalarMap`, then their type hint.
- **Enums.** **Every** enum in the document becomes `$enum("<snake>_enum", [...])`, not only the ones used by models. That includes `SortDirection`, which `ModelPlugin` adds. Enum fields use `<camel>Enum.column("<col>")`.
- **Lists.** Every list field, scalar or not, becomes a single `json(...)` column typed `.$type<T[]>()`.
- **Non-model object, interface or union fields.** A single `json(...)` column typed `.$type<Type>()`. There is no nesting, no per-field filtering and no validation.
- **A field typed as another `@model` without a relation directive** throws "Unsupported field type".
- **Relations.** One `relations(table, {...})` per model, exported as `<camel>Relations`:
  - `@belongsTo` → `belongsTo(target, { from: [source.key], to: [target.id] })`;
  - `@hasOne` / `@hasMany` → `hasOne` / `hasMany(target, { from: [source.id], to: [target.key] })`.
  - Relay connections and `{ items }` connections are resolved back to the node type.
  - The target must be a `@model`: union, interface and plain-object targets throw.

### Not generated

Nothing below is emitted:
- indexes or unique constraints;
- tenancy / scoped columns;
- `guid()` global-id columns;
- `bigint` or `numeric` columns (unless through `scalarMap`);
- check constraints (from `@constraint`);
- polymorphic relations.

## Related

- [Scalars](./scalars.md)
- [Relations](./relations.md)
- [Field visibility](./field-visibility.md)
- [Drizzle](./drizzle.md) — the equivalent Drizzle generator
- [Known gaps](../internals/known-gaps.md)
