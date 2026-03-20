# gqlbase

A GraphQL schema transformer and code generator with a plugin-based architecture.

gqlbase takes annotated GraphQL schemas and generates full schemas with CRUD operations, relation types, and filter inputs, along with TypeScript type definitions. Transformations are driven by directives like `@model`, `@hasOne`, and `@hasMany`, and the plugin system makes it extensible.

## Quick Start

```bash
npm install gqlbase graphql
```

Create a config file and run the CLI:

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

```bash
npx gqlbase
```

See the [`gqlbase` package README](packages/gqlbase/README.md) for full documentation.

## Packages

| Package | Description |
|---|---|
| [`gqlbase`](packages/gqlbase) | Main package — install this one |
| [`@gqlbase/core`](packages/core) | Transformer engine, plugin system, definition nodes |
| [`@gqlbase/cli`](packages/cli) | CLI, configuration, file watching |
| [`@gqlbase/plugins`](packages/plugins) | Built-in plugins and presets |
| [`@gqlbase/shared`](packages/shared) | Shared utilities |

## Example

The [`example/`](example) directory contains a Farmers Market Platform schema demonstrating all features including models, relations, visibility directives, and custom scalars.

## Development

```bash
npm install       # install dependencies
npm run build     # build all packages
npm run dev       # watch mode
npm run test      # run tests
npm run lint      # lint with auto-fix
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## License

MIT
