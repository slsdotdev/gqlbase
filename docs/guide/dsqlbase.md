# dsqlbase

_Audience: people generating a [dsqlbase](https://github.com/slsdotdev/dsqlbase) schema (Aurora DSQL ORM) from their `@model` types._

```js
import { dsqlbase } from "@gqlbase/plugins/dsql";

plugins: [dsqlbase()];
```

`dsqlbase(options)` returns `[dsqlBaseUtilsPlugin(), dsqlbaseSchemaGeneratorPlugin(options)]`. `DsqlBaseUtilsPlugin` (`packages/plugins/src/dsql/DsqlBaseUtilsPlugin/DsqlBaseUtilsPlugin.ts`) declares the [table directives](#indexes-and-unique-constraints) and [`@embedded`](#embedded-objects). The generator is `DsqlBaseSchemaGeneratorPlugin` (`packages/plugins/src/dsql/DsqlBaseSchemaGeneratorPlugin/DsqlBaseSchemaGeneratorPlugin.ts`). It writes `dsqlbase/schema.ts`, which imports builders from `dsqlbase/schema` and the types of object and list columns from `../schema.types.js` (`<Type>OwnFields`, the stored shape without relations), and re-exports those types. A column type the schema types do not export, such as a `@serverOnly` object, is declared in the file itself.

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
| `scalarMap` | `{}` | `Record<scalarName, { type, dataType, options? }>`. `dataType` is the column builder: a `dsqlbase/schema` export (`numeric`, `varchar`, …) or the local `safeint`. `type` is the TS type used when the scalar is in a list (`array(…).$type<type[]>()`). `options` is passed as the builder's second argument. Takes precedence over the built-in mapping and the type hint. |
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
import { $enum, table, uuid, text, array, record, hasMany, belongsTo, relations } from "dsqlbase/schema";
import { type AddressOwnFields } from "../schema.types.js";
export type { AddressOwnFields } from "../schema.types.js";

export const statusEnum = $enum("status_enum", ["OPEN", "CLOSED"]);

export const users = table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: statusEnum.column("status"),
  tags: array("tags").$type<string[]>(),
  address: record("address").$type<AddressOwnFields>(),
}).meta({ __typename: "User" as const });

export const posts = table("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  userId: uuid("user_id"),
  authorId: uuid("author_id"),
}).meta({ __typename: "Post" as const });

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
- **`id`.** Always `.primaryKey().defaultRandom()`, whatever its type. A `GUID` id is a `guid()` column; see [Global ids](#global-ids).
- **`$$meta`.** Every table carries `.meta({ __typename: "<Type>" as const })`, so every row dsqlbase returns has `row.$$meta.__typename`.
- **Not null.** `.notNull()` when the field is non-null or `@semanticNonNull`. A member of an [embedded](#embedded-objects) field is not null only when the field is too.
- **Scalars.** Mapped as in [Scalars](./scalars.md): `ID` → `uuid`, `String` → `text`, `Int` → `int`, `Float` → `real`, `Boolean` → `bool`, `DateTime` → `timestamp(…, { mode: "iso" })`, `SafeInt` → `safeint` (see below), … Custom scalars use `scalarMap`, then their type hint.
- **Enums.** An enum becomes `$enum("<snake>_enum", [...])` only when a non-list column of a stored model uses it; the column is `<camel>Enum.column("<col>")`. A list of enums is an `array()` column typed with the enum's TS type. An enum a member of an [embedded](#embedded-objects) type uses counts as a column.
- **Lists.** Every list field, scalar, enum or object, `@embedded` included, becomes one `array(...)` column, a `jsonb` array typed `.$type<T[]>()`. Its `<Type>ListFilterInput` (`contains`, `exists`) runs as it is.
- **`@embedded` fields.** A group of columns; see [Embedded objects](#embedded-objects).
- **Other non-model object, interface or union fields.** One `record(...)` column, a `jsonb` document typed `.$type<Type>()`. There is no validation. dsqlbase filters a document by `exists`, but not by its members: the generated filter's nested `where` throws on it. Mark the type `@embedded` to filter by members.
- **A field typed as another `@model` without a relation directive** throws "Unsupported field type".
- **Relations.** One `relations(table, {...})` per model, exported as `<camel>Relations`. A relation to a model in another data source keeps its key column but gets no relation, since there is no table to relate to:
  - `@belongsTo` → `belongsTo(target, { from: [source.key], to: [target.id] })`;
  - `@hasOne` / `@hasMany` → `hasOne` / `hasMany(target, { from: [source.id], to: [target.key] })`.
  - Relay connections and `{ items }` connections are resolved back to the node type.
  - A union or interface target becomes a `union()`; see [Polymorphic relations](#polymorphic-relations). A plain-object target throws.

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
- `numeric` columns (unless through `scalarMap`);
- check constraints (from `@constraint`).

## Global ids

A model whose `id` is [`GUID`](./scalars.md#guid) is a dsqlbase **node**: its primary key is `guid("id")`, so ids leave dsqlbase as `guid:<base64url>`, naming the table by its schema alias (`products`) as well as the row. The database still holds a uuid, and switching a column between `uuid()` and `guid()` changes no DDL. See dsqlbase's global-ids guide for the format and the lookups.

```graphql
type Vendor @model {
  id: GUID!
  products: Product @hasMany
}

type Product @model {
  id: GUID!
  parent: Product @belongsTo
  category: Category @belongsTo
}

type Category @model {
  id: ID!
}
```

```ts
export const vendors = table("vendors", {
  id: guid("id").primaryKey().defaultRandom(),
}).meta({ __typename: "Vendor" as const });

export const products = table("products", {
  id: guid("id").primaryKey().defaultRandom(),
  vendorId: guid("vendor_id", "vendors").notNull(),
  parentId: guid("parent_id", "products"),
  categoryId: uuid("category_id"),
}).meta({ __typename: "Product" as const });
```

- **Relation keys** that hold a node's ids are `guid("<col>", "<alias>")`, so `product.vendorId === product.vendor.id`. dsqlbase requires both sides of a relation to agree, and they do by construction. A [tenancy claim](./tenancy.md) that is the key becomes the same `guid()` column, whatever type its scope declares.
- **A key to a `GUID` model in another [data source](./data-sources.md)** is `text()`. `guid()` can only name a node in this schema, and the other source owns its ids, so the column stores one exactly as it is given (wrapped, as `node` needs it). Filter it with the same form.
- **Other keys** keep their own column. The key of a `@belongsTo` to a union is covered in [Polymorphic relations](#polymorphic-relations).
- **Any other `GUID` field throws**: `GUID` identifies a model. Use `UUID` or `ID`.
- **Reading by id.** `dsql.$findByGlobalId({ id })` reads the row an id names, through the table's model client, so the tenant predicate applies. Its rows carry `$$key`, the schema alias, and `$$meta.__typename`, the GraphQL type. A `Query.node` resolver returns `{ ...row, __typename: row.$$meta.__typename }` (see [Relay](./relay.md#node-interface)).
- **Raw uuids are accepted** wherever a `guid()` column is, on writes and in filters. An id naming another node throws `GlobalIdError("key_mismatch")`.

## Polymorphic relations

A relation to a [union or an interface](./relations.md#union-and-interface-targets) whose members are all tables of this source relates to a dsqlbase `union()` of them, exported once under the target's schema alias. A member in another data source leaves the relation to a resolver; its key columns stay.

```graphql
union Owner = Invoice | PaymentOrder

type Resource @model {
  id: GUID!
  owner: Owner @belongsTo
}

type Folder @model {
  id: GUID!
  documents: Document @hasMany   # interface Document, implemented by Invoice and PaymentOrder
}
```

```ts
export const resources = table("resources", {
  id: guid("id").primaryKey().defaultRandom(),
  ownerId: guid("owner_id"),
  ownerType: text("owner_type").$type<"invoices" | "paymentOrders">(),
}).meta({ __typename: "Resource" as const });

export const owners = union({ invoices, paymentOrders });
export const documents = union({ invoices, paymentOrders });

export const resourceRelations = relations(resources, {
  owner: belongsTo(owners, {
    from: [resources.columns.ownerId],
    to: [owners.columns.id],
    discriminator: resources.columns.ownerType,
  }),
});

export const folderRelations = relations(folders, {
  documents: hasMany(documents, {
    from: [folders.columns.id],
    to: { invoices: [invoices.columns.folderId], paymentOrders: [paymentOrders.columns.folderId] },
  }),
});
```

- **The discriminator** (`<field>Type`) is a `text` column typed with the members' schema aliases, which is what dsqlbase stores in it.
- **The key** of a `@belongsTo` is a keyless `guid()` when the members have `GUID` ids: dsqlbase wraps each id with the member its row names, and **writing a global id fills the discriminator**. Without `GUID` ids it is a plain column, and the discriminator must be written with it.
- **`@hasOne` / `@hasMany`** to a union or an interface name each member's key.
- **A member's reverse `@hasMany`** onto the polymorphic key (`Invoice.resources @hasMany(key: "ownerId")`) is a plain `hasMany`: dsqlbase correlates it on the id alone (see [Relations](./relations.md#union-and-interface-targets)).
- **Rows** of a union carry `$$key`, the member alias, and `$$meta.__typename`, so a resolver returns `{ ...row, __typename: row.$$meta.__typename }`.
- A union whose schema alias is already a table's throws; rename one of them.

## Embedded objects

An [`@embedded`](./embedded-objects.md) type is declared once with `embedded({...})`, and each field of that type is a group of its columns, `<field>_<member>`:

```graphql
type Money @embedded {
  amount: Int!
  currency: Currency!
}

type Product @model {
  id: ID!
  price: Money!
  compareAt: Money
}
```

```ts
export const money = embedded({
  amount: int("amount").notNull(),
  currency: currencyEnum.column("currency").notNull(),
});
export const moneyNullable = embedded({
  amount: int("amount"),
  currency: currencyEnum.column("currency"),
});
export const products = table("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  price: money.column("price"), // price_amount, price_currency
  compareAt: moneyNullable.column("compare_at"), // compare_at_amount, compare_at_currency
}).meta({ __typename: "Product" as const });
```

- **Members** are columns, generated by the same rules as a table's, nested `@embedded` fields included (`address.geo` → `address_geo_lat`). A list member is an `array()` column, any other object a `record()`.
- **Nullability.** dsqlbase has no nullability on a group, only on its members, and reads a group as `null` when all of its columns are `NULL`. A member column is `NOT NULL` only when the field and the member are both non-null. A nullable field of a type with a required member uses a second shape, `<type>Nullable`, whose members are all nullable. The generated input keeps the group all-or-nothing on writes, but a read types each member `| null`; a resolver that returns the group asserts it is complete.
- **Shapes** are exported as `camelCase` of the type, before the tables, nested shapes first. A shape whose name is a table's schema alias throws.

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
- every name in `columns`, `include` and `fields`, and every `@unique` field, is a column of the table: a field of the type that is not a relation, not `@clientOnly`, and not a `jsonb` column (lists and other objects), which DSQL cannot index. Name a relation by its key field (`vendorId`). Tenancy claims are columns too, and are not added to indexes for you;
- a member of an `@embedded` field is named by its path (`price.amount`, `address.geo.lat`); the group itself is not a column. `@index` and `@unique` cannot sit on the `@embedded` type, whose members are columns of each model that uses it;
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
- **`@embedded` fields** filter by `exists` and a nested `where` on the members, and order by members through a nested input (`orderBy: { price: { amount: desc } }`), both as dsqlbase takes them.
- **Not supported by dsqlbase on `jsonb` documents:** a nested `where` on a field whose type is not `@embedded` (see [Rules](#rules)).

## Related

- [Scalars](./scalars.md)
- [Relations](./relations.md)
- [Field visibility](./field-visibility.md)
- [Data sources](./data-sources.md)
- [Drizzle](./drizzle.md) — the equivalent Drizzle generator
- [Known gaps](../internals/known-gaps.md)
