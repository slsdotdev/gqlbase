---
"@gqlbase/plugins": minor
---

`dsqlbase()` declares table directives that mirror the dsqlbase schema builders: `@index(name, columns, unique, include, distinctNulls)` (repeatable, on a type), `@unique(fields: [...])` on a type for a composite unique constraint, and `@unique` on a field for a unique column. A new `DsqlBaseUtilsPlugin` declares them, checks that every named field is an indexable column of a stored model once relation keys and tenancy claims exist, rejects duplicate index names, and removes the directives from the output. The generator emits `.unique()` on the column, and `table.index(...)` / `table.unique(...)` statements after the table.

Docs: docs/guide/dsqlbase.md#indexes-and-unique-constraints, docs/guide/drizzle.md
