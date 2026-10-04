# Embedded objects

_Audience: people using the [dsqlbase](./dsqlbase.md) plugin whose models hold value objects, such as `Money` or `Address`, that they want to filter, order or index by member._

```graphql
type Money @embedded {
  amount: Decimal!
  currency: Currency!
}

type ProductVariant @model {
  id: ID!
  price: Money!
  compareAtPrice: Money
}
```

`@embedded` marks an object type as a **value object**. It is stored as columns of each model that uses it, rather than as one document. In GraphQL, TypeScript and Zod it stays a nested object: `variant.price.amount`. `@embedded` is a dsqlbase feature: `DsqlBaseUtilsPlugin` (`packages/plugins/src/dsql/DsqlBaseUtilsPlugin/DsqlBaseUtilsPlugin.ts`) declares and checks it, and it is removed from the output schema. Without `dsqlbase()` the directive is not declared. The plugin marks each embedded type with core's `@sortable`, which is how `orderBy` reaches its members ([Models](./models.md#ordering)).

An object type without `@embedded` is a **document**. It is one value, read and written whole. Both kinds are output types with a generated `<Type>Input` (see [Models](./models.md#mutation-inputs)); only storage, filtering and ordering differ.

## Rules

An `@embedded` type:
- is not a `@model`;
- has no `id` field and no relations (`@hasOne`, `@hasMany`, `@belongsTo`), since its members are columns of another model's row;
- does not contain itself, directly or through another `@embedded` type. A list of itself is fine, since a list is a document.

Each of these throws during the transform.

## What changes with `@embedded`

| | `@embedded` field | Any other object field |
| --- | --- | --- |
| dsqlbase storage | one column per member, `<field>_<member>` ([dsqlbase](./dsqlbase.md#embedded-objects)) | one `jsonb` column (`record()`) |
| `filter` | `{ exists, where: { <member>: … } }`, run by dsqlbase | the same input; dsqlbase runs `exists` only |
| `orderBy` | `{ <field>: { <member>: asc } }` | not sortable |
| `@index` / `@unique` | members by path: `"price.amount"` | not indexable |

- **Lists** of any type, `@embedded` included, are one `jsonb` array (`array()`), filtered with `contains` and `exists`. A list of `@embedded` items gets no list filter (see [Known gaps](../internals/known-gaps.md)).
- **Nesting.** An `@embedded` member of an `@embedded` type chains its prefix (`address.geo.lat` → `address_geo_lat`), in filters, ordering and index paths alike.
- **Visibility** directives on the field (`@readOnly`, `@serverOnly`, …) apply to the whole group, as to any field.

## Nullability

A nullable field of an embedded type is either `null` or a whole value:
- **Writes.** The generated `<Type>Input` requires the members the type requires, so a client sets all of them or none.
- **Storage.** dsqlbase reads a group as `null` when all of its columns are `NULL`, and has no nullability on the group itself. A member column is therefore `NOT NULL` only when the field and the member are both non-null. The database does not stop a partial group written outside the API.
- **Reads.** dsqlbase types each member of a nullable group `| null`. A resolver that returns the group where GraphQL expects the type asserts it is complete (`example/src/resolvers/user.ts`).

## Upgrading existing tables

`@embedded` is opt-in. Lists and other objects move from `json` to `jsonb` columns (`array()`, `record()`), which dsqlbase can filter. DSQL cannot change a column's type, and the dsqlbase migration planner refuses the change. Existing tables need a new column, a backfill (`to_jsonb(<old>)`), then a switch. Marking an existing type `@embedded` is the same kind of change, from one `json` column to a group of columns.

## Related

- [dsqlbase](./dsqlbase.md#embedded-objects) — the generated `embedded()` shapes
- [Models](./models.md#filter-inputs) — filter inputs and `orderBy`
- [0009 — Embedded objects](../decisions/0009-embedded-objects.md)
