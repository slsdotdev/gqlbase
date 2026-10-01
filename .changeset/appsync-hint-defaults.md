---
"@gqlbase/plugins": minor
---

The AppSync schema maps a custom scalar by its type hint instead of throwing: `id` → `ID`, `string` → `String`, `number` → `Float`, `boolean` → `Boolean`, `object` → `AWSJSON`. `scalarMappings` still takes precedence. Only a scalar with an `unknown` or missing hint must be mapped, and the error now names the scalar and the option. The hints are recorded during `generate`, since cleanup removes them before `output()`.

Docs: docs/guide/appsync.md, docs/guide/scalars.md, docs/internals/testing.md
