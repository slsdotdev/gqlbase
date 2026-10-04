---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

A built-in `GUID` scalar for global ids: a model's id that also names its model. Declare `id: GUID!` on a model, or `interface Node { id: GUID! }` with `relay` on to give every model one.
- `get<Model>`, `delete<Model>` and `Query.node` take the id as the model's (or `Node`'s) id type instead of always `ID`.
- With `relay`, a model without an `id` gets the one `Node` declares before relations and operations read it.
- Relation keys take the target's id type, as before. A declared key must match it where `GUID` is involved; a tenancy claim used as the key keeps its type.
- Mappings: TS `string`, Zod `z.string()`, AppSync `ID`, Drizzle `uuid`; filters as an id.

Docs: docs/guide/scalars.md#guid, docs/guide/models.md, docs/guide/relations.md, docs/guide/relay.md
