---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

**Breaking:** filters use one operator vocabulary on every backend: `eq neq lt lte gt gte in between beginsWith endsWith contains exists`, with `and`, `or` and `not`.

- Renamed: `ne` → `neq`, `le` → `lte`, `ge` → `gte`. `notContains: x` becomes `not: { <field>: { contains: x } }`, and `size` is removed. `endsWith` is new.
- `Date`, `DateTime`, `Time` and `Timestamp` filter as dates: ranges and `between`, no substring operators.
- `between` is typed as a pair: `[T, T]` in TypeScript, `z.tuple` in Zod.
- Lists of scalars and enums filter with `<Type>ListFilterInput { contains: [T!], exists }`.
- Object and interface fields filter through `<Type>FieldFilterInput { exists, where }`, to any depth. Union fields get `exists`.
- `@readOnly` fields are filterable. `@writeOnly` fields are not, unless they are also `@filterOnly`.
- Every `@hasMany` field takes `filter`, whatever type declares it.
- **Ordering.** Every `@hasMany` field and list query takes `orderBy: <Target>OrderByInput`, a `{ field: asc | desc }` map. `SortDirection` is `asc`/`desc`. `@sortable` lets a field of an object type order by the object's members.

Read more: [Filter inputs](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/models.md#filter-inputs), [Operator sets](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/models.md#operator-sets), [Ordering](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/models.md#ordering).
