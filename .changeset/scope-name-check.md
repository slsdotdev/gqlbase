---
"@gqlbase/core": patch
---

`@scope(name:)` with a name that is not a declared tenancy scope now throws. It was accepted and the model was left in no scope, because SDL validation does not check argument values.

Docs: docs/guide/tenancy.md#scope
