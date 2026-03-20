# @gqlbase/plugins

Built-in plugins and presets for gqlbase.

This is an internal package. Install the main [`gqlbase`](https://www.npmjs.com/package/gqlbase) package instead.

## What this package provides

**Base preset** (`gqlbase/plugins/base`):

- `ScalarsPlugin` — registers built-in scalar types
- `UtilitiesPlugin` — processes visibility and scope directives
- `ModelPlugin` — generates CRUD operations from `@model` types
- `RelationsPlugin` — resolves `@hasOne` and `@hasMany` relations
- `SchemaGeneratorPlugin` — outputs the transformed schema
- `ModelTypesGeneratorPlugin` — outputs TypeScript type definitions

**Relay preset** (`gqlbase/plugins/relay`):

- `NodeInterfacePlugin` — adds the Relay `Node` interface
- `ConnectionPlugin` — generates connection and edge types

## License

MIT
