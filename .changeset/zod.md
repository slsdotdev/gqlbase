---
"@gqlbase/plugins": minor
---

**Breaking:** the Zod schemas follow the public schema.

- `Create<Model>InputSchema` and `Update<Model>InputSchema` have exactly the fields of the GraphQL inputs: no `@readOnly` or `@serverOnly` fields and no relation keys. Validate `args.input`, then add the values the server sets. A model gets a schema only for the inputs it has, and nested objects reference `<Type>InputSchema`.
- `<Type>Schema` leaves out `@serverOnly` fields, and definitions clients cannot reach get no schema. A union lists only its public members.
- `zodSchemaGeneratorPlugin({ scalars })` sets the Zod code for a named scalar: `{ Currency: 'z.string().regex(/^[A-Z]{3}$/)' }`.

Read more: [Zod](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/zod.md).
