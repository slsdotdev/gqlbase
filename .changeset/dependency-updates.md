---
"@gqlbase/cli": patch
"@gqlbase/core": patch
"@gqlbase/shared": patch
---

Dependency updates: the `graphql` peer dependency of `@gqlbase/core` and `@gqlbase/shared` is now `^16.14.2`, and `@gqlbase/cli` uses `tinyglobby` `^0.2.17`. The example's resolvers move to the `query` / `mutation` / `object` builders of `@middy-appsync/graphql` 0.1.5.

Docs: docs/guide/relay.md
