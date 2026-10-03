---
"@gqlbase/plugins": patch
---

`@index` columns no longer take `sort`, and `DsqlSortOrder` is gone: dsqlbase 0.2.0 removed `.sort()` from index columns, since DSQL refuses `ASC` / `DESC` on index keys. `nulls` remains.

Docs: docs/guide/dsqlbase.md#indexes-and-unique-constraints
