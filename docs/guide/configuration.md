# Configuration

_Audience: people configuring the gqlbase CLI for a project._

## Config file

The CLI looks in the current working directory for, in order:

1. `gqlbase.config.js`
2. `gqlbase.config.mjs`
3. `gqlbase.config.cjs`

TypeScript config files (`gqlbase.config.ts`) are **not** supported; the entry is commented out in `packages/cli/src/config/resolveConfig.ts`. The file is loaded with a dynamic `import()` and must have a default export. If no file is found the CLI exits with an error; there is no config-less mode.

```js
// gqlbase.config.js
import { defineConfig } from "@gqlbase/cli/config";
import { zodSchemaGeneratorPlugin } from "@gqlbase/plugins/zod";
import { dsqlbase } from "@gqlbase/plugins/dsql";

export default defineConfig({
  source: "src/schema",
  output: "generated",
  transform: {
    relay: true,
    semanticNullability: true,
  },
  plugins: [zodSchemaGeneratorPlugin(), dsqlbase()],
});
```

`defineConfig` is an identity function that only provides typing (`packages/cli/src/config/defineConfig.ts`).

## Options

Defined in `packages/cli/src/config/config.ts`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `source` | `string \| string[]` | `"**/*.graphql"` | Files, globs or directories. A directory is expanded to every `.graphql`, `.gql` and `.graphqls` file below it. `node_modules`, `dist`, `build` and `.git` are always ignored. |
| `output` | `string` | `"generated"` | Output directory. Each plugin chooses its file path relative to it. |
| `plugins` | `(IPluginFactory \| IPluginFactory[])[]` | `[]` | Plugin factories and presets (arrays of factories), in execution order. |
| `transform` | `object` | `{}` | Transformer options, below. |
| `verbose` | `boolean` | `false` | Debug logging. |
| `watch` | `boolean` | `false` | Re-run on changes to `source` (the output directory is ignored). |

### Transformer options

`transform` holds the options that shape the generated schema. The CLI passes them to the transformer, which fills in defaults and freezes them onto `context.options`; every plugin reads them there. They are defined in `packages/core/src/context/TransformerOptions.ts`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `relay` | `boolean` | `false` | Relay output: the `Node` interface on models and Relay connections for list relations. Registers `NodeInterfacePlugin` and `ConnectionPlugin`. See [Relay](./relay.md). |
| `semanticNullability` | `boolean` | `false` | Declares `@semanticNonNull`. When off, a schema that uses the directive fails validation. See [Models](./models.md#nullability-and-semanticnonnull). |
| `operations` | `OperationType[]` | `["read", "write"]` | Operations generated for every `@model` that does not list its own. See [Models](./models.md#operations). |

All matching files are read and concatenated into one document before parsing (`packages/shared/src/files/definitionFromFiles.ts`), so types can be split across files and extended with `extend type`.

## CLI

```
gqlbase [source] [options]
```

| Flag | Overrides |
| --- | --- |
| `[source]` (positional) | `source` |
| `-c, --config <file>` | path to the config file (instead of the default search) |
| `-o, --output <dir>` | `output` |
| `-v, --verbose` | `verbose` |
| `-w, --watch` | `watch` |

Resolution order is defaults → config file → CLI flags (`packages/cli/src/config/resolveConfig.ts`). A single run exits with code 1 when the transform fails. In watch mode, runs are debounced by 100 ms, and a failed run is logged without stopping the watcher.

## Plugins, presets and order

A plugin factory is a function returning `{ create(context) }`; presets are plain functions returning an array of factories. Nested arrays are flattened one level, so presets and single plugins can be mixed freely.

**Core plugins.** The transformer always registers these first, in this order (`packages/core/src/plugins/corePlugins.ts`): `InternalUtilsPlugin` (which provides `@gqlbase_internal` and `@gqlbase_typehint`), `UtilitiesPlugin`, `InterfaceUtilsPlugin`, `ScalarsPlugin`, then `RfcFeaturesPlugin` when `semanticNullability` is on, then `ModelPlugin`, `RelationsPlugin`, then `NodeInterfacePlugin` and `ConnectionPlugin` when `relay` is on, then `SchemaGeneratorPlugin`, `ModelTypesGeneratorPlugin`. They cannot be removed or reordered, and are configured only through the [transformer options](#transformer-options).

**Order matters.** Your plugins are registered after the core plugins, in the order listed. Within every phase, plugins run in registration order. Plugin names must be unique, so the same plugin cannot be registered twice.

| Preset / factory | Import | Plugins |
| --- | --- | --- |
| `appsyncPreset({ … })` | `@gqlbase/plugins` | `AppSyncUtilsPlugin`, `AppSyncSchemaGeneratorPlugin`, `MiddyAppSyncGraphQLPlugin` (optional) |
| `zodSchemaGeneratorPlugin({ … })` | `@gqlbase/plugins/zod` | `ZodSchemaGeneratorPlugin` |
| `dsqlbase()` | `@gqlbase/plugins/dsql` | `DsqlBaseSchemaGeneratorPlugin` |
| `drizzleSchemaGeneratorPlugin({ … })` | `@gqlbase/plugins/drizzle` | `DrizzleSchemaGeneratorPlugin` |

The core plugins and their helpers (`isModel`, `isRelationField`, `isSemanticNullable`, …) are exported from `@gqlbase/core/plugins` for plugin authors.

## Output files

| File (relative to `output`) | Written by |
| --- | --- |
| `schema.graphql` | `SchemaGeneratorPlugin` |
| `schema.types.ts` | `ModelTypesGeneratorPlugin`: types that match `schema.graphql`. Capability plugins import from it and re-export what they use. |
| `appsync/schema.graphql` | `AppSyncSchemaGeneratorPlugin` |
| `appsync/middy-appsync.types.ts` | `MiddyAppSyncGraphQLPlugin` |
| `zod/schema.validators.ts` | `ZodSchemaGeneratorPlugin` (`fileName` option) |
| `dsqlbase/schema.ts` | `DsqlBaseSchemaGeneratorPlugin` |
| `drizzle/schema.ts` | `DrizzleSchemaGeneratorPlugin` (`fileName` option) |

Existing files are overwritten; files a plugin no longer produces are not deleted.

## Programmatic use

```js
import { createTransformer } from "@gqlbase/core";

const transformer = createTransformer({ semanticNullability: true });
const output = transformer.transform(sdlString);

output.schema; // printed schema.graphql
output.files; // [{ type, path, filename, content }]
```

`createTransformer` takes the [transformer options](#transformer-options) at the top level, next to `plugins`, with the same defaults. `transform()` returns `{ schema, files }` merged with whatever each plugin's `output()` returns (`schemaTypes` holds the content of `schema.types.ts`). Nothing is written to disk; the CLI does that.

## Migrating from 0.1

0.2.0 moves the base and Relay plugins into core, adds transformer options, and changes some output paths ([decision 0003](../decisions/0003-core-plugins-and-transformer-options.md)).

**Config.**

```diff
  import { defineConfig } from "gqlbase/config";
- import { basePreset, relayPreset, appsyncPreset } from "gqlbase/plugins";
+ import { appsyncPreset } from "gqlbase/plugins";

  export default defineConfig({
    source: "src/schema",
    output: "generated",
+   transform: {
+     relay: true,               // was relayPreset()
+     semanticNullability: true, // needed if the schema uses @semanticNonNull
+     operations: ["read"],      // was basePreset({ operations })
+   },
-   plugins: [basePreset({ operations: ["read"] }), relayPreset(), appsyncPreset()],
+   plugins: [appsyncPreset()],
  });
```

- `basePreset()`, `relayPreset()` and the `plugins/base` and `plugins/relay` subpaths are removed. The base plugins and their helpers (`isModel`, `isRelationField`, `isSemanticNullable`, …) are exported from `@gqlbase/core/plugins`.
- `@semanticNonNull` is declared only with `semanticNullability: true`. Without it, a schema that uses the directive fails validation.

**Imports of generated files.**

| 0.1 | 0.2 |
| --- | --- |
| `generated/models.typegen` | `generated/schema.types` |
| `generated/dsqlbase.schema` | `generated/dsqlbase/schema` |
| `generated/appsync/middy-appsync.typegen` | `generated/appsync/middy-appsync.types` |

**Output changes to check.**

- `schema.types.ts` matches `schema.graphql`: it no longer has `@serverOnly` or `@writeOnly` fields, relation keys or unused definitions. Resolver code that reads those from a parent uses the AppSync `<Type>Source` type, which its `source` now has.
- Unused enums, inputs, unions and scalars are no longer printed in `schema.graphql` or the AppSync schema.
- Without Relay, `@hasMany` fields and list queries return `[T!]` (was `[T]`), or `[T!]!` for a non-null field. `relationPlugin({ usePaginationTypes })` and its `{ items, nextToken }` shape are removed.
- With Relay and without `semanticNullability`, `edges` is `[XEdge!]!` and `XEdge.node` is non-null.

## Related

- [Install](./install.md)
- [Architecture](../internals/architecture.md) — the phases and how plugins are called
- [Plugin API](../internals/plugin-api.md) — writing your own plugin
- [Known gaps](../internals/known-gaps.md)
