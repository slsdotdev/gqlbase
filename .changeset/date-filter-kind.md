---
"@gqlbase/core": minor
---

`Date`, `DateTime`, `Time` and `Timestamp` get their own filter kind: `eq neq lt lte gt gte in between exists`. `Date`/`DateTime`/`Time` lose the string operators (`beginsWith`, `endsWith`, `contains`); month scoping is `{ between: ["2026-09-01", "2026-09-30"] }`.

Docs: docs/guide/models.md#operator-sets, docs/guide/scalars.md
