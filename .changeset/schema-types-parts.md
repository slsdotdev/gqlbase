---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

`schema.types.ts` becomes support types. Each object and interface has three parts: `<Type>OwnFields` (its fields, without relations), `<Type>Relations` (its relations, all optional) and `<Type>Full` (both); the bare name is gone. A `Scalars` map types each scalar on its `input` and `output` side, and fields reference it. `@gqlbase_typehint` takes an optional `input` hint, and `AWSJSON` is a string on input. `__typename` and `RequiredTypename` are gone. dsqlbase and Drizzle type object columns with `<Type>OwnFields`.

Migration: `Post` → `PostFull`, or `PostOwnFields` for a stored shape.

Docs: docs/guide/configuration.md#schema-types, docs/guide/scalars.md#type-hints, docs/guide/relations.md, docs/guide/dsqlbase.md, docs/guide/drizzle.md
