# Tenancy

_Audience: people whose records belong to a tenant (a workspace, a vendor, a user) and must be scoped by it._

```js
defineConfig({
  transform: {
    tenancy: {
      workspace: { default: true, claims: { workspaceId: "ID" } },
      global: { claims: null },
    },
  },
});
```

A **scope** names the claims that a scoped model carries. A **claim** is a field holding the tenant's id, such as `workspaceId`. The ORM fills it from the caller's identity, so it is never part of the API. gqlbase only declares the claims. Who may read or bypass them (admins, public reads, roles) is an access policy for the ORM and the resolvers, not for the schema.

The `tenancy` [transformer option](./configuration.md#transformer-options) registers the core `TenancyPlugin` (`packages/core/src/plugins/TenancyPlugin/TenancyPlugin.ts`), right after `ModelPlugin`. Without it, `@scope` is not declared, and a schema that uses it fails validation.

## Scopes

| Key | Type | Description |
| --- | --- | --- |
| `claims` | `Record<string, string> \| null` | Claim field name → scalar type name. `null` is a scope without claims, for global models. |
| `default` | `boolean` | Puts every stored model without `@scope` in this scope. At most one scope is the default. |

With no default scope, a model is in no scope unless it says so. Nothing is added to existing models when `tenancy` is first configured, unless a scope is the default.

The config is checked when the transformer is created, and the transform throws on:
- more than one default scope;
- a scope name that is not a GraphQL enum value;
- `claims: {}` (use `claims: null`);
- a claim name with different types in two scopes;
- a claim type that is not a scalar (built-in or declared).

## `@scope`

```graphql
enum TenancyScope { workspace global }   # the keys of transform.tenancy
directive @scope(name: TenancyScope!) on OBJECT
```

```graphql
type Invoice @model { … }                         # the default scope: gets workspaceId
type Currency @model @scope(name: global) { … }   # no claims
```

- `@scope` goes on stored models: a `@model` that is not `@clientOnly`. A `@serverOnly` model can be scoped. On any other type it throws.
- A model is in one scope. A scope can declare several claims.
- `@scope` and `TenancyScope` are removed from the output schema.

## Claim fields

Each claim of a model's scope is added to the model as a non-null `@serverOnly` field:

```graphql
# Before
type Invoice @model {
  id: ID!
}

# After (before cleanup)
type Invoice @model {
  id: ID!
  workspaceId: ID! @serverOnly
}
```

- Since it is `@serverOnly`, a claim follows that row of the [field visibility](./field-visibility.md) table. It is in the database table and the AppSync `<Type>Source` type, so resolvers can read it from a parent row. It is not in the public schema, the inputs, the filters, the schema types or the Zod schemas.
- **Claims are added before any other plugin normalizes the schema.** A relation keyed on a claim (`Workspace.invoices: Invoice @hasMany(key: "workspaceId")`) reuses the claim field, and the field stays `@serverOnly`, not `@writeOnly`, so it never reaches an input.
- **A model can declare the claim field itself**, for example to expose it: `workspaceId: ID! @readOnly`. The field is kept as declared, but it must have the claim's type and be non-null, or the transform throws.

For generators, `getScope(model, context.options)` from `@gqlbase/core/plugins` returns `{ name, claims }` for a model in a scope with claims, and `null` otherwise. It reads `@scope`, so call it before `cleanup`, for example in `generate`.

## Database

The dsqlbase generator emits each claim as an ordinary not-null column, like a hand-written `@serverOnly` field. Resolvers set it on writes and filter by it on reads. Declare an index that leads with it.

## Related

- [Decision 0005](../decisions/0005-tenancy-scopes.md)
- [Field visibility](./field-visibility.md)
- [Configuration](./configuration.md#transformer-options)
- [dsqlbase](./dsqlbase.md)
