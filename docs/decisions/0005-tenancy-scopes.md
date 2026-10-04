# 0005 — Tenancy scopes in config, claims as `@serverOnly` fields

- **Date:** 2026-10-02
- **Status:** accepted
- **Proposal:** `tenancy.md`, `zod-public-schemas.md`

## Context

Applications declared their tenant column by hand on every model (`workspaceId: ID! @serverOnly`) and filtered by it in every resolver. dsqlbase scopes tables by **claims**: not-null columns that it fills and filters from the caller's identity, declared with `tenantScope()`. It has no built-in notion of a workspace or a user, and one application can have several kinds of tenant: in the example marketplace, vendors own their catalog and orders, and users own their carts, orders and account records.

## Decision

- **Scopes are defined in config, not as a fixed enum:** `transform.tenancy` maps a scope name to its claims (`{ vendorId: "UUID" }`, or `null` for a scope without claims). `@scope(name:)` puts a stored model in a scope, and the `TenancyScope` enum is generated from the config keys, so the SDL is still validated.
- **No scope by default.** A scope marked `default: true` applies to every stored model without `@scope`; without one, configuring tenancy adds nothing to existing models.
- **A model is in one scope, and a scope can have several claims**, matching dsqlbase, where a table uses one `tenantScope`.
- **A claim is a `@serverOnly` field**, with no visibility class of its own: stored and readable by resolvers, never in the API. A model may declare the field itself to expose it, with the claim's type and non-null.
- **gqlbase only declares claims.** Who may read across them, public reads and roles are access policies for the ORM and the resolvers.
- **Tenancy is a core option**, like `relay`, because the dsqlbase generator and the AppSync types need the scopes, and capability plugins cannot depend on each other.
- **The Zod schemas follow the public schema** (shipped first, separately), so a claim needs no Zod special case.

## Consequences

- Additive and opt-in: `minor`, with no migration for schemas that do not configure tenancy.
- Claim fields are added before any plugin normalizes, so a relation keyed on a claim reuses it rather than adding a `@writeOnly` key.
- The `@scope` directive name is taken by core when tenancy is on; a schema declaring its own `@scope` must rename it.
- Until dsqlbase releases tenancy, the claim is an ordinary not-null column, and resolvers set and filter it. Emitting `tenantScope()`/`<scope>.table()` is a later change, read through `getScope`: done in [0010](./0010-tenant-scope-emission.md).
- Data only admins should reach has no claim. That is an access policy, still to be designed with dsqlbase.

## Docs

- [Tenancy](../guide/tenancy.md)
- [Field visibility](../guide/field-visibility.md), [Configuration](../guide/configuration.md#transformer-options)
