---
"@gqlbase/core": minor
---

Every `@hasMany` field, including `list<Models>`, gets `orderBy: <Target>OrderByInput`, a `{ <field>: SortDirection }` map over the target's sortable fields (non-list scalars and enums the filter accepts). `SortDirection` is now `enum SortDirection { asc desc }` (was `ASC DESC`, unused). The value passes to dsqlbase's `orderBy`. GraphQL does not keep an input object's key order, so priority follows the order the input type declares its fields. With `generateArgumentSchemas`, Zod emits the `orderBy` inputs too.

Docs: docs/guide/models.md#ordering, docs/guide/relations.md, docs/guide/relay.md, docs/guide/zod.md
