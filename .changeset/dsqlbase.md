---
"@gqlbase/plugins": minor
---

**Breaking:** the generated dsqlbase schema requires `dsqlbase@^0.2`.

- **Options.** `dsqlbase({ scalarMap, emitOutput })`, so a config file can map a custom scalar to a column (`{ Decimal: { type: "string", dataType: "numeric" } }`). `@gqlbase/plugins/dsql` exports the option types.
- **Indexes.** `@index(name, columns, unique, include, distinctNulls)` on a type, `@unique(fields:)` on a type for a composite constraint, and `@unique` on a field. Every named field must be an indexable column (not a relation, `@clientOnly` or `jsonb` column), and index names must be unique.
- **Global ids.** A model with `id: GUID!` has a `guid("id")` primary key, and keys that hold its ids are `guid()` columns. Every table carries `.meta({ __typename })`, so rows have `$$meta.__typename`.
- **Polymorphic relations.** A relation to a union or interface of tables relates to an exported `union()`. A `@belongsTo` stores a `guid()` key and a `text` discriminator.
- **Column defaults.** `@defaultNow`, `@defaultRandom` and `@default(value:, onCreate:, onUpdate:)`. A field with a database default or `onCreate` is optional in the create input and its Zod schema.
- `$enum` is emitted only for enums a column uses.

Read more: [dsqlbase](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/dsqlbase.md).
