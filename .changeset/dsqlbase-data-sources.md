---
"@gqlbase/plugins": minor
---

dsqlbase follows data sources: it emits tables only for the models of the source with `type: "dsqlbase"` (exported as `DSQLBASE_DATA_SOURCE_TYPE`, with `isDsqlBaseTable`), and throws when more than one source has that type. A relation to a model in another source keeps its key column but gets no relation. `@index` and `@unique` apply to its tables only. Without `dataSources`, every stored model is a table, as before.

Docs: docs/guide/dsqlbase.md#rules, docs/guide/data-sources.md#generators
