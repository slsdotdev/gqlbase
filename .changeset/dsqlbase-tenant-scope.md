---
"@gqlbase/plugins": minor
---

dsqlbase: emit tenancy scopes as `tenantScope`. Each scope with claims is exported as `<scope>Scope = tenantScope({...})`, and its models as `<scope>Scope.table(...)` without the claim columns, so a client derived with `$identityClaims` fills and filters the claims, and an enforcing client has no tenant table at its root. A claim that keys a node in any table of its scope is that node's `guid()` column in all of them; a claim keying two nodes throws. No claim index is added.

Docs: docs/guide/tenancy.md#database
