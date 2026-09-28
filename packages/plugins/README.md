# @gqlbase/plugins

The built-in plugins and presets for gqlbase:
- `basePreset()`: models, relations, field visibility, scalars, the SDL output and TypeScript model types.
- `relayPreset()`: the Node interface and connections.
- `appsyncPreset()`: the AppSync schema and middy-appsync types.
- Standalone generators: `@gqlbase/plugins/zod`, `@gqlbase/plugins/dsql` and `@gqlbase/plugins/drizzle`.

This is an internal package. Install the main [`gqlbase`](https://www.npmjs.com/package/gqlbase) package instead:

```bash
npm install gqlbase graphql
```

## Documentation

- [Guide](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/README.md): one page per directive family and per generator.
- [Plugin API](https://github.com/slsdotdev/gqlbase/blob/main/docs/internals/plugin-api.md): writing your own plugin.
- [All docs](https://github.com/slsdotdev/gqlbase/blob/main/docs/README.md)

## License

MIT
