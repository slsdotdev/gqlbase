---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

Generated file layout:

- The schema types are written to `schema.types.ts` (was `models.typegen.ts`). `ModelTypesGeneratorPlugin` takes no options any more, and `transform()` always returns their content as `schemaTypes`.
- The dsqlbase schema moves to `dsqlbase/schema.ts` (was `dsqlbase.schema.ts`).
- The Middy AppSync types are written to `appsync/middy-appsync.types.ts` (was `middy-appsync.typegen.ts`). Generated type files now all end in `.types.ts`.
- `dsqlbase/schema.ts` and `appsync/middy-appsync.types.ts` import from `../schema.types` and re-export the schema types they use. A type the schema types do not export (for example a `@serverOnly` object stored in a `json` column, or a hidden field's enum in a `<Type>Source`) is declared in the file itself, through the new `TypesGeneratorBase._referenceType`.
- `<Type>Source` no longer lists hidden relation fields; the row holds their key.
- Drizzle is frozen: it keeps compiling and imports from `../schema.types.js`.

Migration: update imports of `generated/models.typegen` to `generated/schema.types`, of `generated/dsqlbase.schema` to `generated/dsqlbase/schema`, and of `generated/appsync/middy-appsync.typegen` to `generated/appsync/middy-appsync.types`.

Docs: docs/guide/configuration.md, docs/guide/dsqlbase.md, docs/guide/appsync.md, docs/guide/drizzle.md, docs/guide/relations.md, docs/guide/README.md, docs/internals/known-gaps.md
