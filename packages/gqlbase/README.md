# gqlbase

A GraphQL schema transformer and code generator with a plugin-based architecture.

Define your GraphQL schema with directives like `@model`, `@hasOne`, and `@hasMany`, and gqlbase generates the full schema — including CRUD operations, filter inputs, relation types — along with TypeScript type definitions.

## Install

```bash
npm install --save-dev gqlbase graphql@16
```

`graphql` 16 is a required peer dependency. TypeScript comes with gqlbase. Node.js 22 or later.

## Quick Start

Define a schema with the `@model` directive:

```graphql
# schema.graphql

type User @model {
  id: ID!
  name: String!
  email: EmailAddress!
  posts: [Post!]! @hasMany
}

type Post @model {
  id: ID!
  title: String!
  content: String
  author: User! @belongsTo
}
```

Create a configuration file:

```js
// gqlbase.config.js
import { defineConfig } from "gqlbase/config";

export default defineConfig({
  source: "src/schema/**/*.graphql",
  output: "generated",
});
```

Run the transformer:

```bash
npx gqlbase
```

This generates two files in the `generated/` directory:

- `schema.graphql` — the transformed schema with all generated types and operations
- `schema.types.ts` — TypeScript types that match the output schema

## CLI

```
gqlbase [source] [options]
```

| Option | Description |
|---|---|
| `-c, --config <file>` | Path to configuration file |
| `-o, --output <dir>` | Output directory (default: `generated`) |
| `-v, --verbose` | Enable verbose logging |
| `-w, --watch` | Watch schema files for changes |

## Configuration

The `defineConfig` helper provides type-safe configuration:

```js
import { defineConfig } from "gqlbase/config";

export default defineConfig({
  source: "src/schema/**/*.graphql",
  output: "generated",
  plugins: [
    // plugins and presets
  ],
});
```

| Property | Type | Default | Description |
|---|---|---|---|
| `source` | `string \| string[]` | `**/*.graphql` | Files, globs or directories of schema files. The output directory is never read. |
| `output` | `string` | `generated` | Output directory |
| `transform` | `object` | `{}` | Transformer options: `relay`, `semanticNullability`, `operations`, `tenancy`, `dataSources` |
| `plugins` | `IPluginFactory[]` | `[]` | Plugins and presets to apply, in order |
| `verbose` | `boolean` | `false` | Enable debug logging |
| `watch` | `boolean` | `false` | Watch for file changes |

See [Configuration](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/configuration.md) for every option.

## Generators

Add generators as plugins:

```js
import { defineConfig } from "gqlbase/config";
import { appsyncPreset } from "gqlbase/plugins";
import { zodSchemaGeneratorPlugin } from "gqlbase/plugins/zod";
import { dsqlbase } from "gqlbase/plugins/dsql";

export default defineConfig({
  source: "src/schema",
  output: "generated",
  transform: { relay: true },
  plugins: [appsyncPreset(), zodSchemaGeneratorPlugin(), dsqlbase()],
});
```

| Import | Generates |
|---|---|
| `gqlbase/plugins` → `appsyncPreset()` | The AppSync schema and typed resolver definitions for `@middy-appsync/graphql` |
| `gqlbase/plugins/zod` → `zodSchemaGeneratorPlugin()` | Zod validators for the public inputs and objects |
| `gqlbase/plugins/dsql` → `dsqlbase()` | A [dsqlbase](https://www.npmjs.com/package/dsqlbase) schema: tables, relations, indexes |

The generated files import their own runtime packages; [Install](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/install.md#what-the-generated-code-needs-at-runtime) lists them.

## Directives and scalars

`@model` generates operations and inputs; `@hasOne`, `@hasMany` and `@belongsTo` declare relations; `@readOnly`, `@writeOnly`, `@serverOnly`, `@clientOnly`, `@createOnly`, `@updateOnly` and `@filterOnly` control where a field appears. The core also declares `@scope` (tenancy), `@dataSource`, `@sortable`, `@constraint` and `@semanticNonNull`, and the scalars `DateTime`, `Date`, `Time`, `Timestamp`, `SafeInt`, `UUID`, `GUID`, `URL`, `EmailAddress`, `PhoneNumber`, `IPAddress` and `JSON`.

The [directive reference](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/README.md#directive-quick-reference) lists every directive with its arguments, including the generators' own.

## Programmatic API

The transformer can be used programmatically for integration with build tools, CDK, or other pipelines:

```js
import { createTransformer } from "gqlbase";
```

## Documentation

The full documentation lives in the repository's [`docs/`](https://github.com/slsdotdev/gqlbase/blob/main/docs/README.md) folder:

- [Guide](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/README.md): configuration, directives (models, relations, field visibility, scalars) and each generator.
- [Internals](https://github.com/slsdotdev/gqlbase/blob/main/docs/internals/README.md): architecture, the plugin API, and conventions for contributors.
- [Decisions](https://github.com/slsdotdev/gqlbase/blob/main/docs/decisions/README.md): accepted design records.

## Packages

`gqlbase` re-exports the CLI config (`gqlbase/config`), the plugins (`gqlbase/plugins`, `gqlbase/plugins/<name>`) and `createTransformer`. The scoped packages it is built from:

| Package | Description |
|---|---|
| `@gqlbase/core` | Transformer engine, plugin system, and definition node types |
| `@gqlbase/cli` | CLI, configuration loading, and file watching |
| `@gqlbase/plugins` | Built-in plugins and presets |
| `@gqlbase/shared` | Shared utilities (logging, file I/O, error types) |

## License

MIT
