# 0013 — Schema types and Zod row schemas describe the declared schema

- **Date:** 2026-10-23
- **Status:** accepted
- **Proposal:** `schema-types-declared-shape.md`

## Context

[0003](./0003-core-plugins-and-transformer-options.md) gave the output schema, the schema types and the AppSync types one public rule, and the Zod object schemas followed it later. The schema types are mostly read by server code, though. That code had to re-type what the rule hid: `@serverOnly` and `@writeOnly` fields, relation keys, tenancy claims, and `@serverOnly` types. The rule also gave dsqlbase two shapes for the same kind of column. A public object lost its `@serverOnly` members in its column type. A hidden one was declared locally with all of them.

## Decision

- **Two rules.** `isPublicSchemaField` and `collectPublicDefinitions` still decide what reaches the client: `schema.graphql`, the AppSync schema and the AppSync resolver types. `isSchemaTypeField` (every non-internal field) and `collectSchemaTypeDefinitions` decide what server code sees: `schema.types.ts`, the Zod object schemas and the column types of stored outputs.
- **Definitions.** The schema types start from the operation types and from every non-internal definition the source declares (`context.sourceDefinitions`), and follow non-internal fields. A definition a plugin adds that nothing uses, such as the filter input of an unused scalar, is not included.
- **`@writeOnly` keeps its meaning:** stored, never returned. It is in the schema types like any stored field.
- **The AppSync types keep their public surface.** An object's AppSync version is `Omit<<Type>OwnFields, hidden>` plus its relations. A type with hidden fields counts as changed, so every type holding it overrides that field. `<Type>Source` is `<Type> & Partial<Pick<<Type>OwnFields, hidden>>`. The hidden fields are optional whatever their nullability. `source` is what the parent returned, and the parent's result type, `<Type>`, leaves them out, so typing them as required would promise a value nothing guarantees. `@serverOnly` and unreachable definitions get no AppSync version.
- **No local declarations.** Every type a generated file references is in the schema types, so `TypesGeneratorBase._referenceType` only imports, and `TypeReferences` loses `declarations`.

## Consequences

- Breaking, a `minor` changeset in the fixed group. `<Type>OwnFields` and `<Type>Full` gain hidden members, some of them required (claims, non-null keys, `@serverOnly` fields). Code that builds those types from a public payload has to supply them. Zod `<Type>Schema` validates a stored row, not a client payload. The create/update schemas are unchanged.
- `dsqlbase/schema.ts` imports the column type of a `@serverOnly` object as `<Type>OwnFields` instead of declaring `<Type>`.
- Resolver result types are unchanged. A child resolver that read a non-null hidden field from `source` (a claim, a required key) now has to check it is there. `<Type>Source` is written with `Partial<Pick<…>>`, and a hidden field holding an object is typed with its schema-types part.
- Name collisions with generated names (`<Type>Full`, `Scalars`) are now checked for `@serverOnly` and unused declared types too.
- This amends the "one public rule" bullet of [0003](./0003-core-plugins-and-transformer-options.md) and how [0006](./0006-resolver-typings.md) declares `<Type>Source`.

## Docs

- [Field visibility](../guide/field-visibility.md), [Configuration → Schema types](../guide/configuration.md#schema-types)
- [AppSync → AppSync types](../guide/appsync.md#appsync-types), [Zod](../guide/zod.md), [dsqlbase](../guide/dsqlbase.md)
- [Relations](../guide/relations.md), [Tenancy](../guide/tenancy.md)
- [Plugin API](../internals/plugin-api.md), [Architecture](../internals/architecture.md)
