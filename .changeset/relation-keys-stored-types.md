---
"@gqlbase/core": minor
---

Relation keys are added only between stored types: a `@model` that is not `@clientOnly` (an interface or union counts when all its implementations or members do). A relation on a plain type such as `type Viewer { categories: Category @hasMany }` no longer throws for a missing `id` and no longer adds an unfillable key to the target: it is served by a resolver and keeps its list or connection shape. A schema that relied on keys to or from non-model types loses them. The error for a stored relation without an `id` now names the relation and the type that lacks it.

Docs: docs/guide/relations.md
