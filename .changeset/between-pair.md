---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

A filter's `between` is typed as the pair `[T, T]` in the generated TS types and validated with `z.tuple([…, …])` by Zod, so a generated filter, without explicit `null`s, is assignable to dsqlbase's `where`. The schema keeps `[T!]`. The new internal `@gqlbase_tuple(size: Int!)` directive marks such fields and is removed from the output schema.

Docs: docs/guide/dsqlbase.md#filters-and-orderby, docs/guide/models.md#operator-sets, docs/internals/plugin-api.md
