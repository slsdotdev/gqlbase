# 0007 — Global ids through a `GUID` scalar

- **Date:** 2026-10-04
- **Status:** accepted
- **Proposal:** `global-ids.md`

## Context

`Query.node(id)` needs the type of a row from its id alone, and ids were bare uuids. dsqlbase 0.2.0 added `guid()`: a uuid column whose values leave the ORM wrapped with the table's schema alias (`guid:<base64url>`), accepted wrapped or raw, and `$findByGlobalId` to read the row an id names through the model client, so the tenant predicate applies. A table is a node when its primary key is one `guid()` column, and both sides of a relation must agree on it.

## Decision

- **Opt in with a built-in `GUID` scalar.** A model whose `id` is `GUID` is a dsqlbase node. With relay, `interface Node { id: GUID! }` gives every model one; `get`, `delete` and `node` take the id as the model's id type.
- **The node key is the schema alias** (`categories`), dsqlbase's default: `$$key`, `on` and the id agree. Every table carries `.meta({ __typename })`, which maps the alias back to the type.
- **`GUID` identifies models only.** It is valid on a model's `id` and on relation keys; any other `GUID` column throws.
- **Relation keys follow their target.** A key holding a node's ids is `guid(col, "<alias>")`, a tenancy claim used as the key included, whatever type the claim declares. A declared key must match the target id type where `GUID` is involved.
- **Ids of other data sources are the service's.** A service wraps its own ids; a dsqlbase column keyed into such a model is `text()`, holding the id as given.
- **The wire type stays a scalar.** The public schema keeps `scalar GUID`; AppSync maps it to `ID`; Zod accepts any string, since raw uuids are accepted.
- **No `nodeTypes` map yet.** The id names its node, so a `node` resolver dispatches on `decodeGlobalId(id).key`.

Rejected:
- Global ids always on for every dsqlbase table: an explicit scalar makes the wire-format change a choice.
- The GraphQL type name as the node key (`guid("id", "Category")`): the alias is dsqlbase's identity, and `$$key` and `on` use it.
- Emitting `GUID` as `ID` in the public schema: it is a scalar like the others; only AppSync lacks custom scalars.
- A keyless `guid()` or a plain `uuid()` for a `GUID` field that is no id or key: `GUID` has no meaning there.
- `uuid()` for a key into another source's `GUID` model, with resolvers unwrapping ids: the service owns the format.
- Encoding ids in gqlbase resolvers or AppSync templates: dsqlbase owns the codec, at the column.

## Consequences

- Opt-in, `minor`: nothing changes until a schema uses `GUID`. Adopting it changes ids on the wire from uuids to `guid:` strings; existing rows need no migration, since `guid()` has the same DDL as `uuid()`.
- A `node` resolver is still hand-written. It must pass the caller's claims for scoped tables until gqlbase emits `tenantScope()`, and must skip models outside the public schema (`@serverOnly`), which are nodes too.
- Renaming a model changes its schema alias, so ids handed out before the rename no longer resolve.
- Keys to a union stay `uuid()` until polymorphic relations bind them to a discriminator.

## Docs

- [Scalars → `GUID`](../guide/scalars.md#guid), [dsqlbase → Global ids](../guide/dsqlbase.md#global-ids)
- [Relay → `Node` interface](../guide/relay.md#node-interface), [Data sources → Global ids](../guide/data-sources.md#global-ids)
