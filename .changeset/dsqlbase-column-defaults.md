---
"@gqlbase/plugins": minor
---

dsqlbase: column defaults. `@defaultNow` (timestamp columns) → `.defaultNow()`, `@defaultRandom` (uuid/guid columns) → `.defaultRandom()`, and `@default(value:, onCreate:, onUpdate:)` → `.default()`, `.$onCreate()`, `.$onUpdate()`, with TypeScript arguments emitted as written. A field with a database default or `onCreate` is optional in the create input. Zod: `Create<Model>InputSchema` makes a field `.optional()` whenever the create input does.

Docs: docs/guide/dsqlbase.md#column-defaults
