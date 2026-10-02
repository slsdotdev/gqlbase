---
"@gqlbase/core": minor
---

Tenancy scopes. The `transform.tenancy` option declares scopes and their claims, `{ workspace: { default: true, claims: { workspaceId: "ID" } }, global: { claims: null } }`, and registers the core `TenancyPlugin`. `@scope(name: TenancyScope!)` puts a stored model in a scope, and the default scope applies to every stored model without one. Each claim is added to the model as a non-null `@serverOnly` field, before other plugins normalize, so a relation keyed on a claim reuses it. A model can declare the claim field itself to expose it, with the claim's type and non-null. The config is validated when the transformer is created. Generators read a model's scope with `getScope(model, context.options)`. Without `tenancy`, nothing changes.

Docs: docs/guide/tenancy.md, docs/guide/configuration.md#transformer-options, docs/guide/field-visibility.md, docs/internals/architecture.md, docs/internals/plugin-api.md
