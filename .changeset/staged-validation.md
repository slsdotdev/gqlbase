---
"@gqlbase/core": patch
---

The source can reference generated types, such as `StringFilterInput`, `<Model>FilterInput` or `<Model>Connection`. Validation now runs in stages: right after the merge without the known-type-names rule, fully once `execute` has run (so an unknown type still fails, before any generator runs), and on the final document (so a plugin that leaves invalid SDL fails loudly). Transforming plugins skip a type reference they cannot resolve and leave it to validation, so a typo reports "Unknown type" instead of a plugin error. `DocumentNode.validate` takes an optional list of SDL rules.

`@constraint` is now removed from input fields and arguments too, not only from object fields, so the printed schema no longer has dangling `@constraint` usages.

Docs: docs/internals/architecture.md, docs/guide/models.md#referencing-generated-types, docs/guide/field-visibility.md, docs/internals/known-gaps.md
