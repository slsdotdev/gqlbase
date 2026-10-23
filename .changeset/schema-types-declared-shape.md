---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

**Breaking:** `schema.types.ts` and the Zod object schemas describe the declared schema, not only the client one. `<Type>OwnFields`, `<Type>Full` and `<Type>Schema` now include `@serverOnly` and `@writeOnly` fields, relation keys and tenancy claims. `@serverOnly` types, enums that only hidden fields use, and declared definitions nothing uses are typed too, and get a Zod schema. Definitions a plugin adds that nothing uses (filters of unused scalars, unused built-in scalars) stay out. Server code no longer has to re-type hidden fields (`Integration & { vendorId: string }` becomes `IntegrationOwnFields`).

What to check:
- Code that builds an `OwnFields`/`Full` value from a public payload must now supply the required hidden fields, or use the AppSync type instead.
- `<Type>Schema` validates a stored row: it requires non-null hidden fields such as claims and keys. Validate client input with `Create`/`Update<Model>InputSchema`, which are unchanged.
- `dsqlbase/schema.ts` imports the column type of a `@serverOnly` object as `<Type>OwnFields` from the schema types instead of declaring `<Type>` itself.

The output schema, the AppSync schema, the GraphQL inputs and filters, and the dsqlbase tables are unchanged. The AppSync resolver types keep their public surface: `<Type>` omits the hidden fields (`Omit<<Type>OwnFields, …>`). **Breaking:** `<Type>Source` is `<Type> & Partial<Pick<<Type>OwnFields, …>>`, so its hidden fields are optional even when non-null (claims, required relation keys). The parent's result type leaves them out, so nothing guaranteed them. Child resolvers that read them from `source` must check they are there.

For plugin authors: use `isSchemaTypeField` and `collectSchemaTypeDefinitions` for outputs that server code reads, and `isPublicSchemaField`/`collectPublicDefinitions` for the client schema. The context has `sourceDefinitions`, the names the source declares. `TypesGeneratorBase._referenceType(name, refs)` only imports now, and `TypeReferences` has no `declarations`.

Read more: [Field visibility](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/field-visibility.md), [Configuration → Schema types](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/configuration.md#schema-types), [AppSync](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/appsync.md#appsync-types), [Zod](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/zod.md).
