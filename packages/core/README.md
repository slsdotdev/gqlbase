# @gqlbase/core

Core library for gqlbase. Provides the GraphQL transformer engine, plugin system, and definition node types.

This is an internal package. Install the main [`gqlbase`](https://www.npmjs.com/package/gqlbase) package instead.

## What this package provides

- `GraphQLTransformer` — schema transformation pipeline
- `createTransformer` — factory function for creating transformer instances
- `TransformerPluginBase` — abstract base class for building plugins
- `createPluginFactory` — type-safe plugin factory generator
- `TransformerContext` — plugin lifecycle and schema state management
- Definition node classes — `DocumentNode`, `ObjectNode`, `FieldNode`, `InputObjectNode`, `EnumNode`, `UnionNode`, `ScalarNode`, `InterfaceNode`, `DirectiveNode`, `TypeNode`

## License

MIT
