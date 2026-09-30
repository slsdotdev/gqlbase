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
| `@clientOnly` | Computed at runtime: the field (or type) is never stored or written |
| `@serverOnly` | Stored, but the field (or type) is removed from client-facing schemas |
| `@createOnly` | Includes the field only in create inputs |
| `@updateOnly` | Includes the field only in update inputs |
| `@filterOnly` | Includes the field only in filter inputs |

## Built-in Scalars

The core plugins register the following scalar types:

`DateTime` · `Date` · `Time` · `Timestamp` · `UUID` · `URL` · `EmailAddress` · `PhoneNumber` · `IPAddress` · `JSON`

## Presets and Plugins

The core plugins are always registered, before any plugin in your config:

- `ScalarsPlugin` — registers built-in scalar types
- `UtilitiesPlugin` — processes visibility and scope directives
- `InterfaceUtilsPlugin` — copies interface fields into implementing types
- `RfcFeaturesPlugin` — `@semanticNonNull`, when `transform.semanticNullability` is on
- `ModelPlugin` — generates CRUD operations from `@model` types
- `RelationsPlugin` — resolves `@hasOne`, `@hasMany` and `@belongsTo` relations
- `NodeInterfacePlugin` and `ConnectionPlugin` — the Relay `Node` interface and connections, when `transform.relay` is on
- `SchemaGeneratorPlugin` — outputs the transformed `schema.graphql`
- `ModelTypesGeneratorPlugin` — outputs TypeScript type definitions

Transformer options switch core features on:

```js
export default defineConfig({
  transform: {
    relay: true, // Relay-style connections and the Node interface
  },
});
```

Additional presets for specific use cases (AppSync, Zod, etc.) are planned.

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

The `gqlbase` package re-exports all functionality. These internal packages are available for advanced use cases:

| Package | Description |
|---|---|
| `@gqlbase/core` | Transformer engine, plugin system, and definition node types |
| `@gqlbase/cli` | CLI, configuration loading, and file watching |
| `@gqlbase/plugins` | Built-in plugins and presets |
| `@gqlbase/shared` | Shared utilities (logging, file I/O, error types) |

## License

MIT
