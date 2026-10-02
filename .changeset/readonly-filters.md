---
"@gqlbase/core": minor
---

`@readOnly` fields are filterable: `@readOnly` stops writes, not reads, so `createdAt: DateTime @readOnly` now appears in `<Model>FilterInput`. Before, it was left out even with `@filterOnly`.

Docs: docs/guide/field-visibility.md, docs/guide/models.md#filter-inputs
