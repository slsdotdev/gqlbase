---
"@gqlbase/core": minor
---

`@embedded` on an object type marks a value object stored as columns of each model that uses it. It cannot be a `@model`, have an `id` or relations, or contain itself through non-list members. `<Type>OrderByInput` nests an `@embedded` field's own input (`orderBy: { price: { amount: desc } }`). A list's `contains` filter takes `[T!]`, every item given; a single value still works through GraphQL's list coercion.

Docs: docs/guide/embedded-objects.md, docs/guide/models.md#filter-inputs, docs/decisions/0009-embedded-objects.md
