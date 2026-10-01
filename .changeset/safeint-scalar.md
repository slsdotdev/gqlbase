---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

Adds a built-in `SafeInt` scalar and a `bigint` type hint. `SafeInt` is typed `number` (values up to `Number.MAX_SAFE_INTEGER`), filtered like a number, and validated with `z.number().int()`. It maps to `Long` on AppSync and `bigint(…, { mode: "number" })` in Drizzle. `AppSyncUtilsPlugin` declares `Long`. The dsqlbase schema stores it in a `bigint` column through a local `bigintNumber` builder that decodes to `number`. The builder imports `@dsqlbase/core` and is emitted only when a column needs it.

Docs: docs/guide/scalars.md, docs/guide/dsqlbase.md, docs/guide/appsync.md, docs/guide/zod.md, docs/guide/install.md
