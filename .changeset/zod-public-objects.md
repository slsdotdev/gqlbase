---
"@gqlbase/plugins": minor
---

The Zod object schemas follow the public schema. `<Type>Schema` leaves out `@serverOnly` fields (as it already did `@writeOnly` ones), and definitions the client schema does not reach get no schema: `@serverOnly` types, including `@serverOnly @model` types and implementors of public interfaces, and anything only `@serverOnly` fields reach. A union lists only its public members.

Migration: a database row parsed with `<Type>Schema` no longer keeps its `@serverOnly` values. Type rows with the dsqlbase row types instead.

Docs: docs/guide/zod.md, docs/guide/field-visibility.md
