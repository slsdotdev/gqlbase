---
"@gqlbase/core": minor
---

A relation that gets no key field (not between two stored types, or `@clientOnly`) checks a declared `key:`: the field must exist on the type that would hold it, or the transform throws. It was silently ignored.

Docs: docs/guide/relations.md
