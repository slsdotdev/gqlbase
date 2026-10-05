---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

Data sources.

- `transform.dataSources` declares named stores (`{ db: { type: "dsqlbase", default: true }, integrations: { type: "service" } }`), and `@dataSource(name:)` puts a stored model in one. A model without it is in the default source.
- Operations, relation keys, tenancy and the public schema are the same in every source. Generators read the source with `getDataSource` and `isInDataSourceType`.
- dsqlbase emits tables only for the source with `type: "dsqlbase"`, and throws when more than one source has that type. A relation to a model in another source keeps its key column but gets no relation; a key to a `GUID` model there is `text()`.
- Without `dataSources`, nothing changes.

Read more: [Data sources](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/data-sources.md).
