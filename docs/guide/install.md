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
npm install --save-dev gqlbase graphql@16
```

- `graphql` (`^16.8.1`) is a peer dependency of `@gqlbase/core` and `@gqlbase/shared`. Install version 16: gqlbase does not support graphql 17 yet.
- TypeScript comes with gqlbase (`typescript ^6`, a dependency): the code generators build their output with the TypeScript 6 compiler API. Your project can use any TypeScript version, including 7.
- Node.js 22 or later (each package's `engines` field).

The meta-package re-exports the scoped packages under shorter paths. They are interchangeable with the scoped imports:

| `gqlbase` import | Same as |
| --- | --- |
| `gqlbase` | `createTransformer`, `GraphQLTransformer` from `@gqlbase/core` |
| `gqlbase/config` | `@gqlbase/cli/config` |
| `gqlbase/plugins` | `@gqlbase/plugins` |
| `gqlbase/plugins/<name>` (`appsync`, `zod`, `dsql`) | `@gqlbase/plugins/<name>` |

Import from `gqlbase` when it is the only package you installed. The scoped imports resolve only where `@gqlbase/*` is hoisted (npm does this; pnpm and Yarn PnP do not). Installing `@gqlbase/cli` and `@gqlbase/plugins` directly also works; the repository's `example/` project does that (`example/gqlbase.config.js`).

## What the generated code needs at runtime

The generators only write files. The files they write import these packages, which you install in the project that uses the output:

| Generator | Generated file imports | Install |
| --- | --- | --- |
| Zod ([zod.md](./zod.md)) | `zod/v4` | `zod@^4` (or `^3.25`, which ships `zod/v4`) |
| dsqlbase ([dsqlbase.md](./dsqlbase.md)) | `dsqlbase/schema`; `@dsqlbase/core` when a column is `SafeInt` ([why](./dsqlbase.md#safeint-columns)) | `dsqlbase@^0.2`, and `@dsqlbase/core@^0.2` as a direct dependency for `SafeInt` |
| Middy AppSync ([appsync.md](./appsync.md)) | `@middy-appsync/graphql` (module augmentation), `aws-lambda` (types only) | `@middy-appsync/graphql@^0.1.5`, `@types/aws-lambda` |
| AppSync DynamoDB filter ([appsync.md](./appsync.md#dynamodb-filters)) | `@aws-appsync/utils` | `@aws-appsync/utils` (only with `dynamoDBFilter: true`) |

dsqlbase is `0.x`, so a minor release can change its API. The generated schema targets dsqlbase `0.2`.

## Next

Create a config file: [Configuration](./configuration.md).

## Related

- [Guide index](./README.md)
- [Configuration](./configuration.md)
- [Documentation index](../README.md)
