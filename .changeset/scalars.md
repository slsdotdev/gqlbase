---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

Two new built-in scalars, and stricter type hints.

- **`SafeInt`:** an integer within `Number.isSafeInteger`, typed `number`. Zod validates it with `z.number().int()`, AppSync maps it to `Long`, and dsqlbase stores it in a `bigint` column that reads back as a `number` (the generated file imports `@dsqlbase/core` for it).
- **`GUID`:** a global id, a model's id that also names its model. Declare `id: GUID!` on a model, or `interface Node { id: GUID! }` with Relay. `get`, `delete` and `Query.node` take the model's id type.
- **Breaking:** a schema that declares its own `SafeInt` or `GUID`, or `Long` with `appsyncPreset`, now conflicts with the built-in.
- **Breaking:** `@gqlbase_typehint(type:)` takes an enum literal (`type: string`). A string literal or an unknown value fails the transform instead of becoming `unknown`. A scalar can also take an `input` hint for the argument side.
- The AppSync schema maps a custom scalar by its type hint instead of throwing. Only a scalar with an `unknown` or missing hint needs `scalarMappings`.

Read more: [Scalars](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/scalars.md).
