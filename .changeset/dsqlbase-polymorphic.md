---
"@gqlbase/plugins": minor
---

dsqlbase polymorphic relations: a relation to a union or an interface whose members are all dsqlbase tables relates to an exported `union()` of them. A `@belongsTo` stores a keyless `guid()` key (with `GUID` members) and a `text` discriminator typed with the member aliases, and relates through `belongsTo(union, { discriminator })`; `@hasOne` / `@hasMany` name each member's key. Union and interface targets no longer throw.

Docs: docs/guide/dsqlbase.md#polymorphic-relations
