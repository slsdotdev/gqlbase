---
"@gqlbase/core": minor
---

Relations to a union or an interface:
- `@belongsTo` adds a discriminator, `<field>Type: String` (`@serverOnly @writeOnly`, renamed with `discriminator:`), beside the key.
- `@hasOne` / `@hasMany` keys go on every member, nullable as the relation is (they were always non-null). On an interface they go on each implementing type, not on the interface.
- Members that mix `GUID` ids with other id types throw.

Docs: docs/guide/relations.md#union-and-interface-targets, docs/internals/known-gaps.md
