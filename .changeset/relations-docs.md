---
"@gqlbase/core": patch
---

Correct the `RelationsPlugin` docstring: `@hasOne` and `@hasMany` put the key on the target, `@belongsTo` on the source. Document that a nested `<Type>Input` is shared across create and update by design (a non-model object is stored as one JSON value, so writes replace it whole).

Docs: docs/guide/relations.md, docs/guide/models.md, docs/internals/known-gaps.md
