---
"@gqlbase/plugins": minor
---

`appsync/middy-appsync.types.ts` declares an AppSync version of each public object, interface and union under its schema name, built from the schema types' `<Type>OwnFields` with exported utilities: `WithTypename`, `WithRequiredTypename` (unions and interfaces require `__typename`), `WithOptional` and `Override`. Relations are optional and typed with the AppSync versions, so resolvers can return preloaded data. `<Type>Source` builds on the AppSync version. Arguments use the input side of `Scalars`. Only enums, inputs and `Scalars` are re-exported.

`@computed` marks a field that has its own resolver: it gets an entry, and is optional in its type's AppSync version. It does not imply `@clientOnly`, so a stored field can be computed too. It throws on operation fields, relation fields and fields outside the public schema.

`middyAppSync.relationsOnly` is replaced by `middyAppSync.resolvers: "declared" | "all"`.

Migration: `relationsOnly: true` → `resolvers: "declared"`, `relationsOnly: false` → `resolvers: "all"`. Import resolver types from `appsync/middy-appsync.types`.

Docs: docs/guide/appsync.md#resolver-types, docs/guide/field-visibility.md, docs/guide/configuration.md#migrating-from-01
