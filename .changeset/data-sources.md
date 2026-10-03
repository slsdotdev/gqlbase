---
"@gqlbase/core": minor
---

Data sources: the `transform.dataSources` option declares named stores (`{ db: { type: "dsqlbase", default: true }, integrations: { type: "service" } }`), and `@dataSource(name: DataSource!)` puts a stored model in one; a model without it is in the default source. Core only records the source: capability plugins read it with `getDataSource` / `isInDataSourceType` and generate the models of the source types they handle. Operations, relation keys, tenancy and the public schema do not change. Without `dataSources`, nothing changes.

Docs: docs/guide/data-sources.md, docs/guide/configuration.md#transformer-options
