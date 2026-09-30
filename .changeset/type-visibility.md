---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

`@serverOnly` and `@clientOnly` can mark an object type. A field whose type is such an object inherits the directive.

- `@serverOnly` type: removed from the output schema, the schema types and the AppSync types (also as a `Node` implementor), but still stored. A `@serverOnly @model` keeps its table and Zod row schemas and gets no operations.
- `@clientOnly` type: in the output schema, never stored. A `@clientOnly @model` gets only its configured read operations (`get`, `list`), no table and no Zod create/update schemas.

The dsqlbase generator now emits `$enum` only for enums a column uses, instead of every enum in the document.

Docs: docs/guide/field-visibility.md, docs/guide/models.md, docs/guide/dsqlbase.md, docs/guide/zod.md, docs/guide/README.md
