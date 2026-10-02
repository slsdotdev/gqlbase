---
"@gqlbase/core": minor
---

**Breaking:** filter inputs use one operator vocabulary, dsqlbase's, on every backend: `eq neq lt lte gt gte in between beginsWith endsWith contains exists`, plus `and`/`or`/`not`. Migrate client operations:

| 0.1 | 0.2 |
| --- | --- |
| `ne` | `neq` |
| `le` | `lte` |
| `ge` | `gte` |
| `notContains: x` | `not: { <field>: { contains: x } }` |
| `size`, `SizeFilterInput` | removed |
| a list of a built-in scalar filtered with the element's filter | `<Type>ListFilterInput` (`contains`, `exists`) |
| `and`/`or: [XFilterInput]` | `[XFilterInput!]` |

`endsWith` is new on string-like filters. Every list of scalars or enums gets `<Type>ListFilterInput`, including lists of built-in scalars.

Docs: docs/guide/models.md#operator-sets, docs/guide/dsqlbase.md
