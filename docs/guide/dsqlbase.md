# dsqlbase

_Audience: people generating a [dsqlbase](https://github.com/slsdotdev/dsqlbase) schema (Aurora DSQL ORM) from their `@model` types._

```js
import { dsqlbase } from "@gqlbase/plugins/dsql";

plugins: [dsqlbase()];
```

`dsqlbase(options)` returns `[dsqlbaseSchemaGeneratorPlugin(options)]`. The plugin is `DsqlBaseSchemaGeneratorPlugin` (`packages/plugins/src/dsql/DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.ts`). It writes `dsqlbase/schema.ts`, which imports builders from `dsqlbase/schema` and the types of object and list columns from `../schema.types.js`, and re-exports those types. A column type the schema types do not export, such as a `@serverOnly` object, is declared in the file itself.

## Options

```js
dsqlbase({
  scalarMap: {
    Decimal: { type: "string", dataType: "numeric" },
  },
});
```

| Option | Default | Effect |
| --- | --- | --- |
| `scalarMap` | `{}` | `Record<scalarName, { type, dataType, options? }>`. `dataType` is the column builder: a `dsqlbase/schema` export (`numeric`, `varchar`, …) or the local `bigintNumber`. `type` is the TS type used when the scalar is in a list (`json(…).$type<type[]>()`). `options` is passed as the builder's second argument. Takes precedence over the built-in mapping and the type hint. |
| `emitOutput` | `false` | Also return the file content as `output.dsqlBaseSchema`. |

`@gqlbase/plugins/dsql` exports the option types as `DsqlBaseSchemaGeneratorPluginOptions` and `DsqlBaseScalarConfig`.

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
import { type Address } from "../schema.types.js";
export type { Address } from "../schema.types.js";

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

- **Tables.** Every `@model` object becomes `table("<snake_plural>", {...})`, exported as `<camelPlural>`, except `@clientOnly` models, which are never stored. Non-model types produce no table. A `@serverOnly` model keeps its table.
- **Columns.** Every field except `@gqlbase_internal`, `@clientOnly` and relation fields. `@serverOnly`, `@writeOnly` and `@readOnly` fields, and relation keys, are all columns. Column names are `snake_case` of the field name.
- **`id`.** Always `.primaryKey().defaultRandom()`, whatever its type.
- **Not null.** `.notNull()` when the field is non-null or `@semanticNonNull`.
- **Scalars.** Mapped as in [Scalars](./scalars.md): `ID` → `uuid`, `String` → `text`, `Int` → `int`, `Float` → `real`, `Boolean` → `bool`, `DateTime` → `timestamp(…, { mode: "iso" })`, `SafeInt` → `bigintNumber` (see below), … Custom scalars use `scalarMap`, then their type hint.
- **Enums.** An enum becomes `$enum("<snake>_enum", [...])` only when a non-list column of a stored model uses it; the column is `<camel>Enum.column("<col>")`. A list of enums is a `json` column typed with the enum's TS type.
- **Lists.** Every list field, scalar or not, becomes a single `json(...)` column typed `.$type<T[]>()`.
- **Non-model object, interface or union fields.** A single `json(...)` column typed `.$type<Type>()`. There is no nesting, no per-field filtering and no validation.
- **A field typed as another `@model` without a relation directive** throws "Unsupported field type".
- **Relations.** One `relations(table, {...})` per model, exported as `<camel>Relations`:
  - `@belongsTo` → `belongsTo(target, { from: [source.key], to: [target.id] })`;
  - `@hasOne` / `@hasMany` → `hasOne` / `hasMany(target, { from: [source.id], to: [target.key] })`.
  - Relay connections and `{ items }` connections are resolved back to the node type.
  - The target must be a `@model`: union, interface and plain-object targets throw.

### `SafeInt` columns

dsqlbase's `bigint()` decodes to a JS `bigint`, but [`SafeInt`](./scalars.md#safeint) is typed `number`. So when a column is `SafeInt` (or a custom scalar with the `bigint` hint), the file declares a local builder and uses it for that column:

```ts
import { ColumnDefinition, type ColumnConfig } from "@dsqlbase/core";

const bigintNumber = <const TName extends string>(name: TName) => new ColumnDefinition<TName, ColumnConfig<number, string>>(name, {
    dataType: "bigint",
    codec: { encode: value => value.toString(), decode: value => Number(value) }
});

export const invoices = table("invoices", {
  amount: bigintNumber("amount").notNull(),
});
```

The builder and the `@dsqlbase/core` import are emitted only when a column uses them, so a schema without `SafeInt` needs only `dsqlbase`. `ColumnDefinition` is not re-exported from `dsqlbase/schema`, which is why the file imports `@dsqlbase/core` (see [Install](./install.md#what-the-generated-code-needs-at-runtime)).

### Not generated

Nothing below is emitted:
- indexes or unique constraints;
- tenancy / scoped columns;
- `guid()` global-id columns;
- `numeric` columns (unless through `scalarMap`);
- check constraints (from `@constraint`);
- polymorphic relations.

## Related

- [Scalars](./scalars.md)
- [Relations](./relations.md)
- [Field visibility](./field-visibility.md)
- [Drizzle](./drizzle.md) — the equivalent Drizzle generator
- [Known gaps](../internals/known-gaps.md)
