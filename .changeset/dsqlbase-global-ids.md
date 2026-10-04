---
"@gqlbase/plugins": minor
---

dsqlbase global ids: a model with `id: GUID!` is a dsqlbase node, its primary key `guid("id")`. A relation key that holds a node's ids is `guid("<col>", "<alias>")`, a tenancy claim used as the key included, so relation pairs agree. A `GUID` key to a model in another data source, or to a union, is a plain `uuid()`; any other `GUID` field throws. Every table now carries `.meta({ __typename: "<Type>" })`, so rows have `$$meta.__typename`.

Docs: docs/guide/dsqlbase.md#global-ids
