---
"@gqlbase/core": minor
---

A list's `contains` filter takes `[T!]`, every item given; a single value still works through GraphQL's list coercion. New `@sortable` directive on object types: a field of that type orders by its members, through the object's own `<Type>OrderByInput` (`orderBy: { price: { amount: desc } }`). A backend that can order by the members sets it (dsqlbase's `@embedded` does), or the schema author does; it is removed from the output.

Docs: docs/guide/models.md#ordering
