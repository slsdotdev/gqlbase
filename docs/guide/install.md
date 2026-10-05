# Install

_Audience: people adding gqlbase to a project._

gqlbase is published as a set of `@gqlbase/*` packages that are versioned together (a fixed Changesets group), plus a `gqlbase` meta-package.

| Package | Contents |
| --- | --- |
| `@gqlbase/cli` | The `gqlbase` binary, `defineConfig` (`@gqlbase/cli/config`), file watching |
| `@gqlbase/plugins` | Optional plugins and presets (`appsyncPreset`; subpaths `/zod`, `/dsql`) |
| `@gqlbase/core` | Transformer engine, plugin API, definition node classes, and the core plugins every transformer registers (`@gqlbase/core/plugins`) |
| `@gqlbase/shared` | Logger, file I/O, error classes, formatting helpers |
| `gqlbase` | Meta-package: the `gqlbase` binary plus re-exports of the packages above (see below) |

## Recommended install

```bash
npm install --save-dev gqlbase graphql typescript
```

- `graphql` (`^16`) is a peer dependency of `@gqlbase/core` and `@gqlbase/cli`.
- `typescript` is a peer dependency of `@gqlbase/plugins`: the code generators build their output with the TypeScript compiler API.
- Node.js 22 or later (the repository's `engines` field).

The meta-package re-exports the scoped packages under shorter paths. They are interchangeable with the scoped imports:

| `gqlbase` import | Same as |
| --- | --- |
| `gqlbase` | `createTransformer`, `GraphQLTransformer` from `@gqlbase/core` |
| `gqlbase/config` | `@gqlbase/cli/config` |
| `gqlbase/plugins` | `@gqlbase/plugins` |
| `gqlbase/plugins/<name>` (`appsync`, `zod`, `dsql`) | `@gqlbase/plugins/<name>` |

Installing `@gqlbase/cli` and `@gqlbase/plugins` directly also works; the repository's `example/` project does that (`example/gqlbase.config.js`).

## What the generated code needs at runtime

The generators only write files. The files they write import these packages, which you install in the project that uses the output:

| Generator | Generated file imports |
| --- | --- |
| Zod ([zod.md](./zod.md)) | `zod` (v4; the file imports `zod/v4`) |
| dsqlbase ([dsqlbase.md](./dsqlbase.md)) | `dsqlbase` (`dsqlbase/schema`); also `@dsqlbase/core` when a column is `SafeInt` ([why](./dsqlbase.md#safeint-columns)) |
| Middy AppSync ([appsync.md](./appsync.md)) | `@middy-appsync/graphql` (module augmentation), `aws-lambda` types |

## Next

Create a config file: [Configuration](./configuration.md).

## Related

- [Guide index](./README.md)
- [Configuration](./configuration.md)
- [Documentation index](../README.md)
