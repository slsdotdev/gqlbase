# Drizzle

_Audience: people generating a Drizzle ORM (PostgreSQL) schema from their `@model` types._

```js
import { drizzleSchemaGeneratorPlugin } from "@gqlbase/plugins/drizzle";

plugins: [drizzleSchemaGeneratorPlugin({ scalarMap: { Decimal: "numeric" } })];
```

The plugin is `DrizzleSchemaGeneratorPlugin` (`packages/plugins/src/drizzle/DrizzleSchemaGeneratorPlugin/DrizzleSchemaGeneratorPlugin.ts`). It writes `drizzle/<fileName>`, which imports:
- `relations` from `drizzle-orm`;
- column builders from `drizzle-orm/pg-core`;
- object types from `../models.typegen.js`.

| Option | Default | Description |
| --- | --- | --- |
| `fileName` | `"schema.ts"` | File name inside `drizzle/`. |
| `emitOutput` | `false` | Also return the content from `transform()` as `output.drizzleSchema`. |
| `scalarMap` | `{}` | Scalar name → pg-core builder name, or `{ type, config }` (`config` is passed as the builder's second argument). |
| `dialect` | `"postgresql"` | Accepted but not used. Output is always PostgreSQL. |

## Rules

The rules match [dsqlbase](./dsqlbase.md#rules), with these differences:

| | Drizzle | dsqlbase |
| --- | --- | --- |
| Table builder | `pgTable(...)` | `table(...)` |
| Enums | `pgEnum("<snake>_enum", [...])`, used as `<camel>Enum("<col>")` | `$enum(...)`, used as `.column("<col>")` |
| `Float` / `number` hint | `doublePrecision` | `real` |
| `Timestamp` | `integer` | `timestamp` |
| `object` hint | `jsonb` | `json` |
| List fields | element column + `.array()` (Postgres array) | `json(...).$type<T[]>()` |
| Non-model object fields | `json(...).$type<Type>()` | same |
| Relations | `relations(table, ({ one, many }) => ({ ... }))` | `relations(table, { ... })` |
| Relation targets | object, interface or union. The target name is used as a table variable, so non-model targets produce references to tables that do not exist. | `@model` only; throws otherwise |

- **`id`:** `.primaryKey().defaultRandom()`.
- **Not null:** `.notNull()` follows non-null / `@semanticNonNull`.
- **Relation keys and `@serverOnly` fields** are columns.
- **Skipped:** `@clientOnly` fields, relation fields and internal fields.

`DrizzleUtilitiesPlugin` (`packages/plugins/src/drizzle/DrizzleUtilitiesPlugin/`) is an empty placeholder. It has no factory and is not exported.

## Related

- [dsqlbase](./dsqlbase.md)
- [Scalars](./scalars.md)
- [Relations](./relations.md)
- [Known gaps](../internals/known-gaps.md)
