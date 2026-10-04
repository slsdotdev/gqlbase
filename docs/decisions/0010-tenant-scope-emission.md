# 0010 — Tenancy scopes as dsqlbase `tenantScope`

- **Date:** 2026-10-04
- **Status:** accepted
- **Proposal:** `tenant-scope-emission.md`

## Context

[0005](./0005-tenancy-scopes.md) added claim fields to scoped models, and the dsqlbase generator emitted them as ordinary not-null columns, so every resolver set and filtered them by hand, and a `node` resolver carried its own table → scope map. dsqlbase 0.2.0 ships `tenantScope({...})`: claim columns declared once, merged into each table built with `<scope>.table(...)`. A client derived with `$identityClaims` then fills them on inserts and filters by them on every read, joins and `$findByGlobalId` included. An enforcing client has no tenant table at its root. A claim is one definition per scope, the same in every table, and both sides of a relation must agree on `guid()`.

## Decision

- **Always emit.** Each scope with claims becomes `export const <scope>Scope = tenantScope({...})`, and its models `<scope>Scope.table(...)`, without the claim columns. A scope without claims emits nothing. Tenancy has not been released, so no released schema changes.
- **A claim's column follows its key target.** When any table of a scope uses the claim as a key to a node, the scope's column is that node's `guid(col, "<alias>")`, in every table; a claim keying two nodes throws. Otherwise the column follows the claim's type, and two different columns for one claim throw.
- **No claim index.** As in dsqlbase, the application declares an index leading with the claim (`@index`).
- **The export is `<scope>Scope`.** An `@embedded` shape under the same name throws. Table and union aliases are plural and cannot collide.

Rejected:
- An opt-in generator option: it would keep the hand-written claim filters as the default, the failure dsqlbase's tenancy exists to remove.
- Keeping the claim's declared type when it is also a key: the relation pair would be `uuid` against `guid`, which dsqlbase rejects.
- One index per scoped table: it can duplicate the index the application declares anyway.

## Consequences

- `minor`, released with tenancy in 0.2.0.
- An application's request handlers use a client derived per caller; reads across tenants (public search, workers) use a client created with `tenancy: { enforce: false }`, and inserts still need claims.
- A claim that is a key in one table of its scope reads back as a global id in all of them.
- A `node` resolver needs no scope map: `$findByGlobalId` on the caller's client scopes itself.

## Docs

- [Tenancy → Database](../guide/tenancy.md#database)
- [dsqlbase](../guide/dsqlbase.md), [Relay → Node interface](../guide/relay.md#node-interface)
