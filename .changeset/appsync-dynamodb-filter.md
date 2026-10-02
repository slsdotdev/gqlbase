---
"@gqlbase/plugins": minor
---

`appsyncPreset({ dynamoDBFilter: true })` emits `appsync/dynamodb-filter.ts` with `toDynamoDBFilter(filter)` for APPSYNC_JS resolvers. It renames the operators to AppSync's (`neq` → `ne`, `lte` → `le`, `gte` → `ge`, `exists` → `attributeExists`), drops nested `where` conditions and explicit `null`s, rejects `endsWith` with `util.error`, and passes the result to `util.transform.toDynamoDBFilterExpression`.

Docs: docs/guide/appsync.md#dynamodb-filters
