---
"@gqlbase/core": patch
---

`extend` of an undeclared type no longer disappears silently. `extend type Query`, `Mutation` or `Subscription` with no declaration creates the root type (plugins then add their operations to it). Any other extension of an undeclared type, or an extension whose kind does not match the declaration, throws `InvalidDefinitionError` naming the type. A schema that now throws was already losing that extension.

Docs: docs/guide/configuration.md, docs/internals/known-gaps.md
