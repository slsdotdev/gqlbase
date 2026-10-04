---
"@gqlbase/plugins": minor
---

dsqlbase: new `@embedded` directive on object types, declared by `dsqlBaseUtilsPlugin`. It cannot be a `@model`, have an `id` or relations, or contain itself through non-list members, and marks the type `@gqlbase_sortable` so `orderBy` reaches its members. An `@embedded` type is an `embedded({...})` shape and its fields are column groups (`price_amount`, `price_currency`). A member column is not null only when the field and the member are both non-null; a nullable field of a type with a required member uses a `<type>Nullable` shape. `@index` and `@unique` name members by path (`"price.amount"`). Lists are now `array()` and other object fields `record()`, both `jsonb`, so list filters run; this changes the column type of existing `json` columns, which DSQL cannot alter in place (add a column, backfill, switch). AppSync's `toDynamoDBFilter` sends a one-item list `contains` as that item and rejects several.

Docs: docs/guide/dsqlbase.md#embedded-objects, docs/guide/appsync.md#dynamodb-filters, docs/guide/embedded-objects.md
