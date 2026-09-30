# @gqlbase/core

The core library for gqlbase. It contains the transformer pipeline (`createTransformer`, `GraphQLTransformer`), the plugin system (`TransformerPluginBase`, `createPluginFactory`, `TransformerContext`), the core plugins that every transformer registers (models, relations, field visibility, scalars, the SDL and TypeScript types output; `@gqlbase/core/plugins`), and the definition node classes that plugins read and mutate.

This is an internal package. Install the main [`gqlbase`](https://www.npmjs.com/package/gqlbase) package instead:

```bash
npm install gqlbase graphql
```

## Documentation

- [Architecture](https://github.com/slsdotdev/gqlbase/blob/main/docs/internals/architecture.md): packages and the pipeline phases.
- [Plugin API](https://github.com/slsdotdev/gqlbase/blob/main/docs/internals/plugin-api.md): writing a plugin.
- [Definition nodes](https://github.com/slsdotdev/gqlbase/blob/main/docs/internals/definition-nodes.md)
- [All docs](https://github.com/slsdotdev/gqlbase/blob/main/docs/README.md)

## License

MIT
