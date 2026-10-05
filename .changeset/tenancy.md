---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

Tenancy scopes.

- `transform.tenancy` declares scopes and their claims: `{ workspace: { default: true, claims: { workspaceId: "ID" } }, global: { claims: null } }`. `@scope(name:)` puts a stored model in a scope; the default scope applies to every stored model without one. A name that is not a declared scope throws.
- Each claim is added to the model as a non-null `@serverOnly` field, so a relation keyed on a claim reuses it. Declare the field on the model to expose it.
- dsqlbase exports each scope with claims as `<scope>Scope = tenantScope({...})` and its models as `<scope>Scope.table(...)`. A client derived with `$identityClaims` fills and filters the claims.
- Generators read a model's scope with `getScope(model, context.options)`. Without `tenancy`, nothing changes.

Read more: [Tenancy](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/tenancy.md).
