---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

**Breaking:** the output schema prints `GUID` as `ID`. Model ids, `node(id:)`, `get<Model>(id:)`, relation keys, inputs and filters all become `ID`, as Relay requires for `Node.id`. `GUID` fields now filter with the shared `IDFilterInput`, and `GUIDFilterInput` is gone. The generated TS types, Zod schemas and dsqlbase columns are unchanged.

**Breaking:** only a `@belongsTo` decides whether a relation key is required. A `@hasOne`/`@hasMany` now adds a nullable key whatever its own nullability, and leaves a key that a `@belongsTo` on the target stores to that relation. Before, the relation normalized first decided, so a non-null `[Resource!]! @hasMany` could make the key of a nullable `@belongsTo` non-null (`ownerId: guid("owner_id").notNull()`). Keys added only by a non-null `@hasOne`/`@hasMany` lose `.notNull()`. A key that a non-null `@belongsTo` stores may gain it. Declare the key to require it without a `@belongsTo`. A `@hasOne`/`@hasMany` whose key a `@belongsTo` on the target stores must now be pointed at by that `@belongsTo` (the source itself, or a union or an interface including it), or the transform throws. Review your migrations.

For plugin authors: `parseFieldRelation` takes the transformer options as a fourth argument (`this.context.options`).

New transformer options:
- `discriminatorSuffix` names the discriminator of a `@belongsTo` to a union or an interface. For example, `"kind"` gives `ownerKind`. The default stays `"type"`.
- `semanticNullability: "force"` prints every non-null output field except `id` as nullable with `@semanticNonNull`, level by level (`[String!]!` becomes `[String] @semanticNonNull(levels: [0, 1])`). Inputs and generated code are unchanged. The AppSync schema, which drops the directive, prints those fields as plain nullable.

Read more: [Relations](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/relations.md), [Models](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/models.md#nullability-and-semanticnonnull), [Scalars](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/scalars.md#guid), [Relay](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/relay.md), [Configuration](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/configuration.md#transformer-options).
