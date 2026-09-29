# Relay

_Audience: people exposing Relay-style connections and the `Node` interface._

```js
import { basePreset, relayPreset } from "@gqlbase/plugins";

plugins: [basePreset(), relayPreset()];
```

`relayPreset()` takes no options and registers two plugins:
- `NodeInterfacePlugin` (`packages/plugins/src/relay/NodeInterfacePlugin/NodeInterfacePlugin.ts`);
- `ConnectionPlugin` (`packages/plugins/src/relay/ConnectionPlugin/ConnectionPlugin.ts`).

Register it after `basePreset()`.

## `Node` interface

- **The interface:** adds `interface Node { id: ID! }`, or reuses an existing `Node` interface. Only its `id` field survives; other fields are removed in `after()`.
- **The query:** adds `Query.node(id: ID!): Node`.
- **Implementors:** every `@model` type implements `Node`, and so does every type that already declares `implements Node`. A missing `id` field is added. An `id` of a different type throws.

The id is passed through unchanged. Nothing encodes the type into it, and no resolver is generated for `node`.

## Connections

Every `@hasMany` field is rewritten into a connection. This covers `@hasMany` fields on any object or interface except `Mutation`, and the generated `list<Models>` queries.

```graphql
type User @model {
  id: ID!
  posts: Post @hasMany
}
```

becomes

```graphql
type User implements Node {
  id: ID!
  posts(filter: PostFilterInput, first: Int, after: String): PostConnection!
}

type PostConnection {
  edges: [PostEdge] @semanticNonNull(levels: [0, 1])
  pageInfo: PageInfo!
}

type PostEdge {
  cursor: String
  node: Post
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

- The field type becomes `<Target>Connection!`, with `first: Int` and `after: String` arguments added. `filter` comes from `ModelPlugin`, and only on `@model` types.
- `edges` carries `@semanticNonNull(levels: [0, 1])` only when `RfcFeaturesPlugin` is registered (it is part of `basePreset()`).
- `cursor` and `node` on the edge are marked `@clientOnly` internally. They get no stored column and no input entry.
- Connection and edge types are shared per target. A type already named `<Target>Connection` or `<Target>Edge` is reused.
- Backward pagination (`last`/`before`), `totalCount` and ordering arguments are not generated.
- Union and interface targets produce `<Union>Connection` / `<Union>Edge` the same way.

`ConnectionPlugin` throws if it finds a `{ items, nextToken }` connection, the shape produced by `relationPlugin({ usePaginationTypes: true })`. The two list shapes cannot be mixed.

## Related

- [Relations](./relations.md)
- [Models](./models.md)
- [dsqlbase](./dsqlbase.md) — connection targets are resolved back to the node type for relations
- [Known gaps](../internals/known-gaps.md)
