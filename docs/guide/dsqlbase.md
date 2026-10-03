# dsqlbase

_Audience: people generating a [dsqlbase](https://github.com/slsdotdev/dsqlbase) schema (Aurora DSQL ORM) from their `@model` types._

```js
import { dsqlbase } from "@gqlbase/plugins/dsql";

plugins: [dsqlbase()];
```

`dsqlbase(options)` returns `[dsqlBaseUtilsPlugin(), dsqlbaseSchemaGeneratorPlugin(options)]`. `DsqlBaseUtilsPlugin` (`packages/plugins/src/dsql/DsqlBaseUtilsPlugin/DsqlBaseUtilsPlugin.ts`) declares the [table directives](#indexes-and-unique-constraints). The generator is `DsqlBaseSchemaGeneratorPlugin` (`packages/plugins/src/dsql/DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.ts`). It writes `dsqlbase/schema.ts`, which imports builders from `dsqlbase/schema` and the types of object and list columns from `../schema.types.js` (`<Type>OwnFields`, the stored shape without relations), and re-exports those types. A column type the schema types do not export, such as a `@serverOnly` object, is declared in the file itself.

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
| `scalarMap` | `{}` | `Record<scalarName, { type, dataType, options? }>`. `dataType` is the column builder: a `dsqlbase/schema` export (`numeric`, `varchar`, …) or the local `safeint`. `type` is the TS type used when the scalar is in a list (`json(…).$type<type[]>()`). `options` is passed as the builder's second argument. Takes precedence over the built-in mapping and the type hint. |
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
import { type AddressOwnFields } from "../schema.types.js";
export type { AddressOwnFields } from "../schema.types.js";

export const statusEnum = $enum("status_enum", ["OPEN", "CLOSED"]);

export const users = table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: statusEnum.column("status"),
  tags: json("tags").$type<string[]>(),
  address: json("address").$type<AddressOwnFields>(),
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

- **Tables.** Every `@model` object becomes `table("<snake_plural>", {...})`, exported as `<camelPlural>`, except `@clientOnly` models, which are never stored. Non-model types produce no table. A `@serverOnly` model keeps its table. With [data sources](./data-sources.md), only the models of the source with `type: "dsqlbase"` become tables; at most one source can have that type.
- **Columns.** Every field except `@gqlbase_internal`, `@clientOnly` and relation fields. `@serverOnly`, `@writeOnly` and `@readOnly` fields, and relation keys, are all columns. Column names are `snake_case` of the field name.
- **`id`.** Always `.primaryKey().defaultRandom()`, whatever its type.
- **Not null.** `.notNull()` when the field is non-null or `@semanticNonNull`.
- **Scalars.** Mapped as in [Scalars](./scalars.md): `ID` → `uuid`, `String` → `text`, `Int` → `int`, `Float` → `real`, `Boolean` → `bool`, `DateTime` → `timestamp(…, { mode: "iso" })`, `SafeInt` → `safeint` (see below), … Custom scalars use `scalarMap`, then their type hint.
- **Enums.** An enum becomes `$enum("<snake>_enum", [...])` only when a non-list column of a stored model uses it; the column is `<camel>Enum.column("<col>")`. A list of enums is a `json` column typed with the enum's TS type.
- **Lists.** Every list field, scalar or not, becomes a single `json(...)` column typed `.$type<T[]>()`. dsqlbase filters a `json` column by `exists` only, so a `<Type>ListFilterInput` cannot be passed to `where` for these columns yet.
- **Non-model object, interface or union fields.** A single `json(...)` column typed `.$type<Type>()`. There is no nesting and no validation. The generated filter has a nested `where` for these fields, but dsqlbase cannot run it: it filters a `json` column by `exists` only.
- **A field typed as another `@model` without a relation directive** throws "Unsupported field type".
- **Relations.** One `relations(table, {...})` per model, exported as `<camel>Relations`. A relation to a model in another data source keeps its key column but gets no relation, since there is no table to relate to:
  - `@belongsTo` → `belongsTo(target, { from: [source.key], to: [target.id] })`;
  - `@hasOne` / `@hasMany` → `hasOne` / `hasMany(target, { from: [source.id], to: [target.key] })`.
  - Relay connections and `{ items }` connections are resolved back to the node type.
  - The target must be a `@model`: union, interface and plain-object targets throw.

### `SafeInt` columns

dsqlbase's `bigint()` decodes to a JS `bigint`, but [`SafeInt`](./scalars.md#safeint) is typed `number`. So when a column is `SafeInt`, or a scalar mapped to `safeint` through `scalarMap`, the file declares a local builder and uses it for that column:

```ts
import { ColumnDefinition, type ColumnConfig } from "@dsqlbase/core";

const safeint = <const TName extends string>(name: TName) => new ColumnDefinition<TName, ColumnConfig<number, string>>(name, {
    dataType: "bigint",
    codec: { encode: value => value.toString(), decode: value => Number(value) }
});

export const invoices = table("invoices", {
  amount: safeint("amount").notNull(),
});
```

The builder and the `@dsqlbase/core` import are emitted only when a column uses them, so a schema without `SafeInt` needs only `dsqlbase`. `ColumnDefinition` is not re-exported from `dsqlbase/schema`, which is why the file imports `@dsqlbase/core` (see [Install](./install.md#what-the-generated-code-needs-at-runtime)).

### Not generated

Nothing below is emitted:
- tenancy / scoped columns;
- `guid()` global-id columns;
- `numeric` columns (unless through `scalarMap`);
- check constraints (from `@constraint`);
- polymorphic relations.

## Indexes and unique constraints

The dsqlbase plugins declare two table directives. They mirror the dsqlbase schema builders, so every option dsqlbase supports is available, and what dsqlbase requires (an index name) is required. Without `dsqlbase()`, the directives are not declared, and a schema that uses them fails validation.

```graphql
enum DsqlNullsOrder { FIRST LAST }
input DsqlIndexColumn { field: String!, nulls: DsqlNullsOrder }

directive @index(
  name: String!
  columns: [DsqlIndexColumn!]!
  unique: Boolean = false
  include: [String!]
  distinctNulls: Boolean
) repeatable on OBJECT

directive @unique(fields: [String!]) repeatable on OBJECT | FIELD_DEFINITION
```

```graphql
type Product @model
  @index(name: "products_vendor_slug_idx", unique: true, columns: [{ field: "vendorId" }, { field: "slug" }])
  @index(name: "products_created_idx", columns: [{ field: "createdAt", nulls: LAST }], include: ["status"])
  @unique(fields: ["vendorId", "sku"]) {
  id: ID!
  code: String! @unique
  …
}
```

| Directive | dsqlbase |
| --- | --- |
| `@index(name, columns, …)` on a type | `table.index(name, { unique })`, with `.columns(...)`, `.include(...)` and `.distinctNulls(...)` |
| `@unique(fields: [...])` on a type | `table.unique((c) => [...])`, a composite unique constraint |
| `@unique` on a field | `column.unique()` |

Rules, checked once relation keys and tenancy claims exist (`execute`):
- every name in `columns`, `include` and `fields`, and every `@unique` field, is a column of the table: a field of the type that is not a relation, not `@clientOnly`, and not a `json` column (lists and objects), which DSQL cannot index. Name a relation by its key field (`vendorId`). Tenancy claims are columns too, and are not added to indexes for you;
- paths into embedded objects (`price.amount`) are rejected until embedded objects are supported;
- index names are unique across the schema;
- `@unique` on a type needs `fields`; on a field it takes none;
- the type is a dsqlbase table: a stored model (a `@model` that is not `@clientOnly`), in the `"dsqlbase"` data source when [data sources](./data-sources.md) are declared.

The generator emits a `@unique` field as `.unique()` on its column, and each `@index` and type-level `@unique` as its own statement after the table, since the builders return the index or constraint rather than the table:

```ts
export const products = table("products", {
  code: text("code").notNull().unique(),
  …
});
products.index("products_vendor_slug_idx", { unique: true }).columns(c => [c.vendorId, c.slug]);
products.index("products_created_idx").columns(c => [c.createdAt.nullsLast()]).include(c => [c.status]);
products.unique(c => [c.vendorId, c.sku]);
```

An index column has no sort direction, since DSQL refuses `ASC` / `DESC` on index keys. A column without `nulls` (nulls as Postgres orders them) emits nothing; `distinctNulls` is emitted only when given. The directives and their types are removed from the output schema.

## Filters and `orderBy`

The generated filter inputs use dsqlbase's operator names, so a `filter` argument is a dsqlbase `where` and an `orderBy` argument is a dsqlbase `orderBy`, with no translation:

```ts
const rows = await dsql.categories.findMany({
  where: withoutNulls(args.filter),
  orderBy: { ...withoutNulls(args.orderBy), id: "asc" },
});
```

- **Explicit `null`s.** GraphQL passes an omitted operand as absent and an explicit one as `null`; dsqlbase reads `null` as a value. Drop explicit `null`s, and the conditions they leave empty, before the call. The example's `withoutNulls` (`example/src/lib/filter.ts`) does this, and `example/test/where.types.ts` checks at compile time that the result is assignable to `where` and `orderBy`.
- **`between`** is typed `[low, high]` in the generated TS types and Zod schemas, matching dsqlbase.
- **Not supported by dsqlbase on `json` columns:** list filters and nested `where` on object fields (see [Rules](#rules)).

## Related

- [Scalars](./scalars.md)
- [Relations](./relations.md)
- [Field visibility](./field-visibility.md)
- [Data sources](./data-sources.md)
- [Drizzle](./drizzle.md) — the equivalent Drizzle generator
- [Known gaps](../internals/known-gaps.md)
