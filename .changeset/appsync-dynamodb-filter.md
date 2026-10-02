---
"@gqlbase/plugins": minor
---

`appsyncPreset({ dynamoDBFilter: true })` emits `appsync/dynamodb-filter.ts` with `toDynamoDBFilter(filter)`: it turns a generated filter input into a DynamoDB request `filter` (`expression`, `expressionNames`, `expressionValues`) for APPSYNC_JS resolvers, nested `where` and `and`/`or`/`not` at any depth included. `endsWith` and an empty `in` go to `util.error`.

Docs: docs/guide/appsync.md#dynamodb-filters
