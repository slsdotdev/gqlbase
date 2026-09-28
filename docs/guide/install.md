# Install

_Audience: people adding gqlbase to a project._

gqlbase is published as a set of `@gqlbase/*` packages that are versioned together (a fixed Changesets group), plus a `gqlbase` meta-package.

| Package | Contents |
| --- | --- |
| `@gqlbase/cli` | The `gqlbase` binary, `defineConfig` (`@gqlbase/cli/config`), file watching |
| `@gqlbase/plugins` | Built-in plugins and presets (`basePreset`, `relayPreset`, `appsyncPreset`; subpaths `/zod`, `/dsql`, `/drizzle`) |
| `@gqlbase/core` | Transformer engine, plugin API, definition node classes |
| `@gqlbase/shared` | Logger, file I/O, error classes, formatting helpers |
| `gqlbase` | Meta-package; its entry point re-exports `createTransformer` and `GraphQLTransformer` |

## Recommended install

```bash
npm install --save-dev @gqlbase/cli @gqlbase/plugins graphql typescript
```

- `graphql` (`^16`) is a peer dependency of `@gqlbase/core` and `@gqlbase/cli`.
- `typescript` is a peer dependency of `@gqlbase/plugins`: the code generators build their output with the TypeScript compiler API.
- Node.js 22 or later (the repository's `engines` field).

This is the combination the repository's `example/` project uses (`example/gqlbase.config.js`).

> The `gqlbase` meta-package declares `"exports": { "./*": … }` with no `"."` entry and only ships `dist/index.js`, so subpath imports such as `gqlbase/config` or `gqlbase/plugins/base` do not resolve. Import from the scoped packages instead. See [Known gaps](../internals/known-gaps.md).

## What the generated code needs at runtime

The generators only write files. The files they write import these packages, which you install in the project that uses the output:

| Generator | Generated file imports |
| --- | --- |
| Zod ([zod.md](./zod.md)) | `zod` (v4; the file imports `zod/v4`) |
| dsqlbase ([dsqlbase.md](./dsqlbase.md)) | `dsqlbase` (`dsqlbase/schema`) |
| Drizzle ([drizzle.md](./drizzle.md)) | `drizzle-orm`, `drizzle-orm/pg-core` |
| Middy AppSync ([appsync.md](./appsync.md)) | `@middy-appsync/graphql` (module augmentation), `aws-lambda` types |

## Next

Create a config file: [Configuration](./configuration.md).

## Related

- [Guide index](./README.md)
- [Configuration](./configuration.md)
- [Documentation index](../README.md)
