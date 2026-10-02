---
"@gqlbase/plugins": minor
---

`Create<Model>InputSchema` and `Update<Model>InputSchema` match the GraphQL `Create<Model>Input` and `Update<Model>Input`: exactly their fields, so `@readOnly` and `@serverOnly` fields and relation keys are gone. Nullability and `@constraint` checks are unchanged, so an update still rejects `null` on a required field. A model gets a schema only for the inputs it has, and nested object fields reference `<Type>InputSchema`, derived from the nested `<Type>Input`, instead of the output `<Type>Schema`. `shouldIncludeInZodCreate` and `shouldIncludeInZodUpdate` are removed.

Migration: validate `args.input` with the schema, then add the values the server sets (timestamps, relation keys, `@serverOnly` fields) to the data you write.

Docs: docs/guide/zod.md, docs/guide/field-visibility.md, docs/guide/models.md#partial-updates-and-null, docs/guide/relations.md
