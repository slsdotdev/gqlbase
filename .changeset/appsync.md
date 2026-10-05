---
"@gqlbase/plugins": minor
---

AppSync resolver types and DynamoDB filters.

- `appsync/middy-appsync.types.ts` declares an AppSync version of each public object, interface and union under its schema name. Relations are optional, so a resolver can return preloaded data. A resolver's `source` is `<Type>Source`, which adds the hidden stored fields (relation keys, `@serverOnly`, `@writeOnly`). Only enums, inputs and `Scalars` are re-exported.
- **Breaking:** `middyAppSync.relationsOnly` is replaced by `resolvers: "declared" | "all"` (`true` → `"declared"`, the default; `false` → `"all"`).
- `@computed` marks a field that has its own resolver: it gets an entry and is optional in its type.
- `appsyncPreset({ dynamoDBFilter: true })` emits `appsync/dynamodb-filter.ts`, whose `toDynamoDBFilter(filter)` turns a generated filter input into a DynamoDB filter for APPSYNC_JS resolvers.

Read more: [AppSync](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/appsync.md).
