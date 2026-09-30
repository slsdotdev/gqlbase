---
"@gqlbase/core": patch
---

`@gqlbase_typehint(type:)` is declared as `TypeHint!`, and a string literal (`type: "string"`) or an unknown value now fails the transform with an error naming the scalar, instead of silently becoming `unknown`. Fixed the `getTypeHint` docstring (the default is `"unknown"`) and the `TypeHint` list in the plugin docstring (adds `object`).

Docs: docs/guide/scalars.md, docs/internals/known-gaps.md
