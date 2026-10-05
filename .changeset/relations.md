---
"@gqlbase/core": minor
---

**Breaking:** relation keys are added only between stored types, and relations to unions and interfaces have their own rules.

- A key is added only when both ends are stored: a `@model` that is not `@clientOnly`, or a union or interface whose members all are. A relation on a plain type (`type Viewer { categories: Category @hasMany }`) is served by a resolver, keeps its shape and adds no key.
- Keys take the target's id type. Where `GUID` is involved, a declared key must match it.
- A declared `key:` on a relation that gets no key field must name an existing field, or the transform throws.
- **Union and interface targets.** `@belongsTo` adds a `<field>Type` discriminator beside the key (rename it with `discriminator:`). `@hasOne` and `@hasMany` keys go on every member and are nullable, as the relation is. For an interface they go on each implementing type. Members that mix `GUID` ids with other id types throw.
- The error for a stored relation without an `id` names the relation and the type.

Read more: [Relations](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/relations.md), [Union and interface targets](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/relations.md#union-and-interface-targets).
