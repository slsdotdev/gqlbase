---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

With `relay: false` (the default), a `@hasMany` field becomes a plain list that keeps the field's nullability and has non-null items: `posts: Post @hasMany` becomes `[Post!]` (was `[Post]`), and `posts: Post! @hasMany` becomes `[Post!]!`. List queries follow the same rule. Models keep the `filter` argument; there are no pagination arguments without Relay.

The `{ items, nextToken }` connection shape and `RelationsPlugin`'s `usePaginationTypes` option are removed, along with `isPaginationConnection`. Connections exist only in the Relay format.

Docs: docs/guide/relations.md, docs/guide/models.md, docs/guide/relay.md
