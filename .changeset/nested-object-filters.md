---
"@gqlbase/core": minor
---

Object and interface fields are filterable through `<Type>FieldFilterInput { exists, where: <Type>FilterInput }`, for example `{ pricingModel: { where: { amount: { lte: 50 } } } }`. `where` has its own `and`/`or`/`not`, to any depth. Union fields get `exists` only; lists of objects are still left out.

Docs: docs/guide/models.md#object-fields, docs/guide/dsqlbase.md
