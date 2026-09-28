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
import { basePreset, relayPreset } from "@gqlbase/plugins";
import { zodSchemaGeneratorPlugin } from "@gqlbase/plugins/zod";
import { dsqlbase } from "@gqlbase/plugins/dsql";

export default defineConfig({
  source: "src/schema",
  output: "generated",
  plugins: [basePreset(), relayPreset(), zodSchemaGeneratorPlugin(), dsqlbase()],
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
| `verbose` | `boolean` | `false` | Debug logging. |
| `watch` | `boolean` | `false` | Re-run on changes to `source` (the output directory is ignored). |

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

Resolution order is defaults → config file → CLI flags (`packages/cli/src/config/resolveConfig.ts`). In watch mode, runs are debounced by 100 ms.

## Plugins, presets and order

A plugin factory is a function returning `{ create(context) }`; presets are plain functions returning an array of factories. Nested arrays are flattened one level, so presets and single plugins can be mixed freely.

**Order matters.** The transformer registers an internal plugin first (`InternalUtilsPlugin`, which provides `@gqlbase_internal` and `@gqlbase_typehint`), then your plugins in the order listed. Within every phase, plugins run in that order. Put `basePreset()` first; the other presets and generators build on the types and directives it adds. Plugin names must be unique, so the same plugin cannot be registered twice.

| Preset / factory | Import | Plugins |
| --- | --- | --- |
| `basePreset({ operations? })` | `@gqlbase/plugins` | `UtilitiesPlugin`, `InterfaceUtilsPlugin`, `ScalarsPlugin`, `RfcFeaturesPlugin`, `ModelPlugin`, `RelationsPlugin`, `SchemaGeneratorPlugin`, `ModelTypesGeneratorPlugin` |
| `relayPreset()` | `@gqlbase/plugins` | `NodeInterfacePlugin`, `ConnectionPlugin` |
| `appsyncPreset({ … })` | `@gqlbase/plugins` | `AppSyncUtilsPlugin`, `AppSyncSchemaGeneratorPlugin`, `MiddyAppSyncGraphQLPlugin` (optional) |
| `zodSchemaGeneratorPlugin({ … })` | `@gqlbase/plugins/zod` | `ZodSchemaGeneratorPlugin` |
| `dsqlbase()` | `@gqlbase/plugins/dsql` | `DsqlBaseSchemaGeneratorPlugin` |
| `drizzleSchemaGeneratorPlugin({ … })` | `@gqlbase/plugins/drizzle` | `DrizzleSchemaGeneratorPlugin` |

`basePreset` takes one option, `operations` (default `["read", "write"]`): the operations generated for every `@model` that does not list its own. See [Models](./models.md#operations).

The individual base plugins are also exported from `@gqlbase/plugins/base` (`modelPlugin`, `relationPlugin`, `utilsPlugin`, `scalarsPlugin`, `rfcFeaturesPlugin`, `schemaGeneratorPlugin`, `modelTypesGeneratorPlugin`) if you need to compose your own preset. `relationPlugin({ usePaginationTypes: true })` is only reachable this way (see [Relations](./relations.md#list-shape)).

## Output files

| File (relative to `output`) | Written by |
| --- | --- |
| `schema.graphql` | `SchemaGeneratorPlugin` |
| `models.typegen.ts` | `ModelTypesGeneratorPlugin` |
| `appsync/schema.graphql` | `AppSyncSchemaGeneratorPlugin` |
| `appsync/middy-appsync.typegen.ts` | `MiddyAppSyncGraphQLPlugin` |
| `zod/schema.validators.ts` | `ZodSchemaGeneratorPlugin` (`fileName` option) |
| `dsqlbase.schema.ts` | `DsqlBaseSchemaGeneratorPlugin` |
| `drizzle/schema.ts` | `DrizzleSchemaGeneratorPlugin` (`fileName` option) |

Existing files are overwritten; files a plugin no longer produces are not deleted.

## Programmatic use

```js
import { createTransformer } from "@gqlbase/core";
import { basePreset } from "@gqlbase/plugins";

const transformer = createTransformer({ plugins: [basePreset()] });
const output = transformer.transform(sdlString);

output.schema; // printed schema.graphql
output.files; // [{ type, path, filename, content }]
```

`transform()` returns `{ schema, files }` merged with whatever each plugin's `output()` returns (for example `modelTypes` when `modelTypesGeneratorPlugin({ emitOutput: true })`). Nothing is written to disk; the CLI does that.

## Related

- [Install](./install.md)
- [Architecture](../internals/architecture.md) — the phases and how plugins are called
- [Plugin API](../internals/plugin-api.md) — writing your own plugin
- [Known gaps](../internals/known-gaps.md)
