---
"@gqlbase/core": minor
---

Every `@hasMany` field gets the `filter` argument, whatever its parent type: a `Viewer` or a field declared on `Query` now gets `filter: <Target>FilterInput` like a model does. Filter inputs move from `ModelPlugin` to a new core plugin, `FilterPlugin`, registered after `ModelPlugin`.

Docs: docs/guide/models.md, docs/guide/relations.md, docs/guide/relay.md, docs/guide/configuration.md
