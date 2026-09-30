---
"@gqlbase/plugins": minor
---

`dsqlbase(options)` passes `scalarMap` and `emitOutput` to the dsqlbase schema generator, so a custom scalar can be mapped to a column (`{ Decimal: { type: "string", dataType: "numeric" } }`) from a config file. `scalarMap` accepts the local `bigintNumber` builder. `@gqlbase/plugins/dsql` exports the option types. This fixes the known gap "`dsqlbase()` factory takes no options".

Docs: docs/guide/dsqlbase.md, docs/guide/scalars.md, docs/internals/known-gaps.md
