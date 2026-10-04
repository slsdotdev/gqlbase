# Relay

_Audience: people exposing Relay-style connections and the `Node` interface._

```js
defineConfig({
  transform: { relay: true },
});
```

The `relay` [transformer option](./configuration.md#transformer-options) registers two core plugins, right after `RelationsPlugin`:
- `NodeInterfacePlugin` (`packages/core/src/plugins/NodeInterfacePlugin/NodeInterfacePlugin.ts`);
- `ConnectionPlugin` (`packages/core/src/plugins/ConnectionPlugin/ConnectionPlugin.ts`).

With `relay` off (the default), neither is registered: there is no `Node` interface and list relations are not rewritten into connections.

## `Node` interface

- **The interface:** adds `interface Node { id: ID! }`, or reuses an existing `Node` interface. Only its `id` field survives; other fields are removed in `after()`.
- **The id type** is the interface's: declare `interface Node { id: GUID! }` to give every model a [global id](./scalars.md#guid).
- **The query:** adds `Query.node(id: <id type>!): Node`.
- **Implementors:** every `@model` type implements `Node`, and so does every type that already declares `implements Node`. A missing `id` field is added with the interface's type, before relations and operations read it. An `id` of a different type throws.

No resolver is generated for `node`; the typed `Query.node` entry in `appsync/middy-appsync.types.ts` requires the result to carry `__typename`. With `ID` ids, the id says nothing about its type. With [`GUID`](./scalars.md#guid) ids, it names its model, so one resolver can read any node. On dsqlbase:

```ts
import { createQueryResolver } from "@middy-appsync/graphql";
import { decodeGlobalId } from "dsqlbase";
import type { Node } from "../generated/appsync/middy-appsync.types";

const node = createQueryResolver({
  fieldName: "node",
  resolve: async ({ args }) => {
    const { key } = decodeGlobalId(args.id); // the schema alias: "categories"
    // A service-backed model: dispatch on `key` to its service here (see Data sources).
    const row = await dsql.$findByGlobalId({ id: args.id });

    return row && ({ ...row, __typename: row.$$meta.__typename } as Node);
  },
});
```

- `row.$$meta.__typename` is set by the generated tables (see [dsqlbase](./dsqlbase.md#global-ids)). The cast is needed because spreading a union of rows does not narrow it.
- **Scope.** `$findByGlobalId` applies dsqlbase's tenant predicate, since the generated tables are [scoped](./tenancy.md#database). Call it on a client derived with the caller's claims (`dsql.$identityClaims(...)`): another tenant's id reads as `null`, and a node in a scope whose claim the caller lacks throws dsqlbase's `TenancyError` when the query is built.
- **Hidden models.** A `@serverOnly` model with a `GUID` id is a node too. Its type is not in the public schema, so return `null` for its key rather than reading it.
- A malformed id makes `decodeGlobalId` throw `GlobalIdError`, an error in the response.

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
  posts(filter: PostFilterInput, orderBy: PostOrderByInput, first: Int, after: String): PostConnection!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}

type PostEdge {
  cursor: String
  node: Post!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

- The field type becomes `<Target>Connection!`, with `first: Int` and `after: String` arguments added. `filter` and `orderBy` come from `FilterPlugin`, on every `@hasMany`, before `first` and `after`.
- `edges` and `node` are non-null, as above. With the `semanticNullability` option on, they stay nullable and carry `@semanticNonNull` instead: `edges: [PostEdge] @semanticNonNull(levels: [0, 1])` and `node: Post @semanticNonNull`.
- `cursor` and `node` on the edge are marked `@clientOnly` internally. They get no stored column and no input entry.
- Connection and edge types are shared per target. A type already named `<Target>Connection` or `<Target>Edge` is reused.
- Backward pagination (`last`/`before`), `totalCount` and ordering arguments are not generated.
- Union and interface targets produce `<Union>Connection` / `<Union>Edge` the same way.

## Related

- [Relations](./relations.md)
- [Models](./models.md)
- [dsqlbase](./dsqlbase.md) — connection targets are resolved back to the node type for relations
- [Known gaps](../internals/known-gaps.md)
