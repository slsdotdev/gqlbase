---
"@gqlbase/core": patch
---

`@writeOnly` fields are no longer in `<Model>FilterInput`, since clients cannot filter on a value they cannot read. Add `@filterOnly` to a `@writeOnly` field to keep it in the filter.

Docs: docs/guide/field-visibility.md, docs/internals/known-gaps.md
