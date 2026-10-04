# 0009 — Embedded objects: opt-in column groups, documents on jsonb

- **Date:** 2026-10-04
- **Status:** accepted
- **Proposal:** `embedded-objects.md`

## Context

Every non-model object field was one `json` column, and every list too. dsqlbase 0.2.0 filters a `json` column by `exists` only, so the generated nested `where` on object fields and the list filters could not run, and nothing in a value object could be ordered or indexed. dsqlbase 0.2.0 added `embedded({...})`, a value object stored as columns of the table that uses it, and `jsonb` columns with operators (`array()`, `record()`). A group has no nullability of its own: each member column is `NOT NULL` or not, and the group reads as `null` when all of them are `NULL`.

## Decision

- **`@embedded` on an object type** makes it a column group, opt-in. It is declared by `ModelPlugin`: no `@model`, no `id`, no relations, and no cycle through non-list members.
- **Nullability follows the field.** A member column is `NOT NULL` only when the field and the member are both non-null. A type used by a nullable field, with a required member, gets a second dsqlbase shape whose members are all nullable (`<type>Nullable`). The generated input keeps writes all-or-nothing; the database does not.
- **Lists and other objects move to `jsonb`**: a list is `array()`, whatever its items; any other object, interface or union is `record()`.
- **A list's `contains` takes `[T!]`**, matching dsqlbase's `@>`: every item given.
- **Ordering and indexes reach members.** `<Type>OrderByInput` nests an embedded field's own input, and `@index` / `@unique` name members by path (`price.amount`). `@unique` cannot sit on a member.
- Filters were already `{ exists, where }`, dsqlbase's group filter, so they did not change.

Rejected:
- Flattening every object by default, with an opt-out: breaking, since every existing object column changes storage.
- A storage argument per field: more to write, for a choice that belongs to the type.
- Throwing on a nullable field of a type with required members: value objects such as `Money` are commonly optional.
- One array column per leaf for lists of embedded types: DSQL has no array type, and leaves lose their alignment.
- A Zod `.schema()` validator on `jsonb` columns, for now: the stored shape and the public Zod schema are not the same thing yet.

## Consequences

- `minor`. Lists and object columns change from `json` to `jsonb`; DSQL cannot alter a column's type, so existing tables need a new column and a backfill. `contains: [T!]` accepts a single value through GraphQL's list coercion.
- A read of a nullable group types each member `| null`; a resolver returning it as the GraphQL type asserts it is complete.
- A nested `where` on a non-embedded object field is still generated, and dsqlbase throws on it.
- Drizzle is unchanged: it still emits `json` columns.

## Docs

- [Embedded objects](../guide/embedded-objects.md)
- [dsqlbase](../guide/dsqlbase.md#embedded-objects)
- [Models](../guide/models.md#filter-inputs)
