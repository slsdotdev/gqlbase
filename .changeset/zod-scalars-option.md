---
"@gqlbase/plugins": minor
---

`zodSchemaGeneratorPlugin({ scalars })` sets the Zod code for a named scalar (custom, gqlbase built-in or GraphQL), used instead of the built-in mapping or the type hint, for example `{ Currency: 'z.string().regex(/^[A-Z]{3}$/)' }`.

Docs: docs/guide/zod.md, docs/guide/scalars.md
