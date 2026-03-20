# gqlbase

A GraphQL schema transformer and code generator with a plugin-based architecture.

Define your GraphQL schema with directives like `@model`, `@hasOne`, and `@hasMany`, and gqlbase generates the full schema — including CRUD operations, filter inputs, relation types — along with TypeScript type definitions.

## Install

```bash
npm install gqlbase graphql
```

`graphql` is a required peer dependency.

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
  author: User! @hasOne
}
```

Create a configuration file:

```js
// gqlbase.config.js
import { defineConfig } from "gqlbase/config";
import { basePreset } from "gqlbase/plugins/base";

export default defineConfig({
  source: "src/schema/**/*.graphql",
  output: "generated",
  plugins: [basePreset()],
});
```

Run the transformer:

```bash
npx gqlbase
```

This generates two files in the `generated/` directory:

- `schema.graphql` — the transformed schema with all generated types and operations
- `models.typegen.ts` — TypeScript type definitions for all schema types

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
| `source` | `string \| string[]` | `**/*.graphql` | Glob pattern(s) for schema files |
| `output` | `string` | `generated` | Output directory |
| `plugins` | `IPluginFactory[]` | — | Plugins and presets to apply |
| `verbose` | `boolean` | `false` | Enable debug logging |
| `watch` | `boolean` | `false` | Watch for file changes |

## Directives

| Directive | Description |
|---|---|
| `@model` | Generates query, mutation, and input types for the annotated type |
| `@hasOne` | Defines a one-to-one relation |
| `@hasMany` | Defines a one-to-many relation |
| `@readOnly` | Excludes the field from input types |
| `@writeOnly` | Excludes the field from output types |
| `@clientOnly` | Removes the field from the generated schema |
| `@serverOnly` | Removes the field from client-facing schemas |
| `@createOnly` | Includes the field only in create inputs |
| `@updateOnly` | Includes the field only in update inputs |
| `@filterOnly` | Includes the field only in filter inputs |

## Built-in Scalars

The base preset registers the following scalar types:

`DateTime` · `Date` · `Time` · `Timestamp` · `UUID` · `URL` · `EmailAddress` · `PhoneNumber` · `IPAddress` · `JSON`

## Presets and Plugins

Presets are collections of plugins. The `basePreset` provides the core transformation capabilities and should always be included.

```js
import { basePreset } from "gqlbase/plugins/base";
import { relayPreset } from "gqlbase/plugins/relay";

export default defineConfig({
  plugins: [
    basePreset(),
    relayPreset(), // adds Relay-style connections and Node interface
  ],
});
```

**Base preset** includes:

- `ScalarsPlugin` — registers built-in scalar types
- `UtilitiesPlugin` — processes visibility and scope directives
- `ModelPlugin` — generates CRUD operations from `@model` types
- `RelationsPlugin` — resolves `@hasOne` and `@hasMany` relations
- `SchemaGeneratorPlugin` — outputs the transformed `schema.graphql`
- `ModelTypesGeneratorPlugin` — outputs TypeScript type definitions

**Relay preset** adds:

- `NodeInterfacePlugin` — adds the Relay `Node` interface
- `ConnectionPlugin` — generates connection and edge types for pagination

Additional presets for specific use cases (AppSync, Zod, etc.) are planned.

## Programmatic API

The transformer can be used programmatically for integration with build tools, CDK, or other pipelines:

```js
import { createTransformer } from "gqlbase";
```

## Packages

The `gqlbase` package re-exports all functionality. These internal packages are available for advanced use cases:

| Package | Description |
|---|---|
| `@gqlbase/core` | Transformer engine, plugin system, and definition node types |
| `@gqlbase/cli` | CLI, configuration loading, and file watching |
| `@gqlbase/plugins` | Built-in plugins and presets |
| `@gqlbase/shared` | Shared utilities (logging, file I/O, error types) |

## License

MIT
