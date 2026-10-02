# 0004 — One filter vocabulary, `orderBy` maps, and relation keys only between stored types

- **Date:** 2026-10-02
- **Status:** accepted
- **Proposal:** `filter-operators.md`, `filters-and-ordering.md`

## Context

One GraphQL API is served from several backends: dsqlbase, an internal DynamoDB client, and AppSync resolvers that call DynamoDB directly. The filter operators came from `@aws-appsync/utils` (`ne`, `le`, `ge`, `notContains`, `size`), which neither dsqlbase nor DynamoDB's own helper matched exactly, so every backend translated. Object fields could not be filtered, there was no `orderBy`, and `filter` was only added to `@hasMany` fields on models. A `@hasMany` on a plain type such as `Viewer` threw for a missing `id`, or added a key column that nothing could fill.

## Decision

- **One vocabulary, dsqlbase's names**, the same on every model whatever its backend: `eq neq lt lte gt gte in between beginsWith endsWith contains exists`, plus `and`, `or` and `not`. `notContains` (use `not`), `size` and `SizeFilterInput` are removed, with no transition aliases. Date scalars get ranges and no substring operators. Every list of scalars or enums gets `<Type>ListFilterInput` (`contains`, `exists`).
- **Nested objects through an explicit `where`:** `<Type>FieldFilterInput { exists, where: <Type>FilterInput }`. Operators on the object sit beside `where`, so a member named like an operator is never ambiguous.
- **Adapters per backend, not per model.** dsqlbase takes the filter as its `where` (`between` is generated as a `[T, T]` pair for this). AppSync DynamoDB resolvers use a generated `toDynamoDBFilter`, which renames the operators back to AppSync's for `util.transform.toDynamoDBFilterExpression` and drops nested `where`: AppSync has no nested paths, and APPSYNC_JS cannot walk a filter tree (no recursion, and `for…of` does not visit appended elements). The internal client adopts the names.
- **`filter` and `orderBy` on every `@hasMany`**, whatever the parent type, from a core `FilterPlugin`.
- **`orderBy` is a `{ <field>: SortDirection }` map**, `enum SortDirection { asc desc }`, over the readable stored scalar and enum fields. GraphQL does not keep an input object's key order (graphql-js rebuilds it in declaration order), so **priority follows the order the input type declares its fields**, not the client's.
- **Relation keys only between stored types:** a key is added only when both ends are a `@model` that is not `@clientOnly`. Any other relation is resolved by a resolver and keeps its shape and arguments.
- **`@readOnly` fields are filterable and sortable:** `@readOnly` stops writes, not reads.

## Consequences

- Client operations change (`ne` → `neq`, `le` → `lte`, `ge` → `gte`, `notContains` → `not`). This ships in 0.2.0 as `minor` changesets in the fixed group, with a migration table in [Models](../guide/models.md#migrating-from-the-01-operators).
- A schema that relied on keys to or from non-model types loses them.
- Clients cannot choose sort priority between several keys: the schema author does, by field order. A list of `{ field, direction }` can be added later if that is needed.
- dsqlbase 0.1.6 cannot yet run a nested `where` or list filters on `json` columns; the schema offers them ahead of it. AppSync DynamoDB resolvers ignore nested `where`.
- Lists of objects are still not filterable.

## Docs

- [Models](../guide/models.md): filter inputs, operator sets, object fields, ordering, migration.
- [Relations](../guide/relations.md): keys only between stored types; arguments on `@hasMany`.
- [dsqlbase](../guide/dsqlbase.md): filters and `orderBy` pass through.
- [AppSync](../guide/appsync.md): DynamoDB filters.
