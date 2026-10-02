# Architecture

_Audience: contributors and agents._

gqlbase reads a GraphQL SDL document and runs it through an ordered set of plugins. Some plugins transform the schema: they add types, fields, inputs and operations based on directives. Others generate code from the result, such as TypeScript types, Zod validators, ORM schemas and an AppSync schema. The core engine knows nothing about any directive; every behaviour lives in a plugin.

## Workspaces

The repo is an npm workspaces monorepo orchestrated by Turborepo. All published packages version together (a Changesets `fixed` group, `.changeset/config.json`).

| Package | Path | Role |
|---|---|---|
| `@gqlbase/shared` | `packages/shared` | Logger, errors, string formatting, file I/O (`definitionFromFiles`, `writeOutputFile`), codegen helpers. No gqlbase dependencies. |
| `@gqlbase/core` | `packages/core` | Definition nodes, `TransformerContext` and the transformer options, the plugin contract, `GraphQLTransformer`, `createTransformer`, and the core plugins every transformer registers (`packages/core/src/plugins/`). Depends on `shared`, with `graphql` as a peer dependency. |
| `@gqlbase/plugins` | `packages/plugins` | The optional plugins and presets. Depends on `core` and `shared`, with `typescript` as a peer dependency (generators build code through the TS factory API). |
| `@gqlbase/cli` | `packages/cli` | The `gqlbase` binary, config loading, and watch mode. Depends on `core` and `shared`. |
| `gqlbase` | `packages/gqlbase` | Meta-package that re-exports the others. |

Dependency direction is `shared ← core ← plugins`, with `cli` depending on `core` and `shared`. `cli` does not depend on `plugins`: the user's config imports the plugins and passes factories in.

**Plugin dependency rule.** The core plugins are always registered, so any plugin may rely on the definitions they add and import their helpers from `@gqlbase/core/plugins`. A plugin must not depend on an optional plugin (anything in `@gqlbase/plugins`), because a config can leave it out. Optional plugins therefore never import each other; a helper two of them need belongs in core.

Each package exposes subpaths through `"./*": "./dist/*/index.js"`, for example `@gqlbase/core/definition`, `@gqlbase/plugins/zod` and `@gqlbase/shared/errors`. A new subpath is therefore a new directory with an `index.ts`.

### Plugins directory map (`packages/plugins/src`)

| Directory | Contents | How it is imported |
|---|---|---|
| `appsync/` | `AppSyncUtilsPlugin`, `AppSyncSchemaGeneratorPlugin`, `MiddyAppSyncGraphQLPlugin` | `appsyncPreset()` |
| `zod/` | `ZodSchemaGeneratorPlugin` | `@gqlbase/plugins/zod` |
| `dsql/` | `DsqlBaseSchemaGeneratorPlugin` | `@gqlbase/plugins/dsql` |
| `drizzle/` | `DrizzleSchemaGeneratorPlugin` | `@gqlbase/plugins/drizzle` |

The root `packages/plugins/src/index.ts` exports only the appsync preset. Each plugin's options, directives and output are covered in the [guide](../guide/README.md).

## Entry points

- **CLI.** `packages/cli/src/action.ts` resolves the config (`packages/cli/src/config/resolveConfig.ts`). `packages/cli/src/transform/transform.ts` then does three things:
  1. builds a transformer once with `createTransformer`;
  2. on each run, reads every source file through `definitionFromFiles` (`packages/shared/src/files/definitionFromFiles.ts`), which concatenates the matched files into one SDL string;
  3. writes each `output.files[i]` relative to the configured output directory.

  Watch mode lives in `packages/cli/src/watch/`.
- **Programmatic.** Call `createTransformer({ plugins, logger, ...transformerOptions })` and then `transformer.transform(sdl)`. The result is a `TransformerOutput` (`{ schema, files, ...pluginKeys }`) and nothing is written to disk.

## The transformer pipeline

`createTransformer` (`packages/core/src/transformer/createTransformer.ts`) creates a `TransformerContext`. It then registers plugins in this order:

1. the core plugins, from `corePlugins()` (`packages/core/src/plugins/corePlugins.ts`), in a fixed order: `InternalUtilsPlugin`, `UtilitiesPlugin`, `InterfaceUtilsPlugin`, `ScalarsPlugin`, then `RfcFeaturesPlugin` when `options.semanticNullability` is on, then `ModelPlugin`, `FilterPlugin`, `RelationsPlugin`, then `NodeInterfacePlugin` and `ConnectionPlugin` when `options.relay` is on, then `SchemaGeneratorPlugin`, `ModelTypesGeneratorPlugin`;
2. every factory from `options.plugins`, flattened in config order.

`SchemaGeneratorPlugin.output` runs once every plugin has cleaned up. Before printing `schema.graphql`, it removes every definition that nothing public reaches (`collectPublicDefinitions`), leftover `@gqlbase_internal` definitions included. The AppSync schema is printed in a later `output` hook, from the same pruned document, so both contain only what the client can reach.

The transformer options (`relay`, `semanticNullability`, `operations`) are resolved with their defaults and frozen onto `context.options` before any plugin is created.

Presets are plain arrays of factories, so they expand in place. Registering a plugin calls its `init()` straight away. Plugin names must be unique.

`GraphQLTransformer.transform` (`packages/core/src/transformer/GraphQLTransformer.ts`) then runs:

| # | Phase | Scope | What happens |
|---|---|---|---|
| 0 | init | per plugin, at registration | Plugins add directive, enum and scalar definitions to `context.base`. |
| 1 | start + validate | document | `context.startWork` merges `base` with the parsed source (`DocumentNode.merge`, which throws on duplicate names). It then runs `validateSDL` **without** the known-type-names rule, because the source may reference types plugins generate later (`StringFilterInput`, `<Model>FilterInput`, `<T>Connection`). Unknown directives, duplicate names and bad arguments still throw `TransformerValidationError` here. |
| 2 | `before()` | per plugin | Setup that needs the merged document, e.g. shared filter inputs or the `Node` interface. |
| 3 | `normalize(def)` | every definition × every matching plugin | Prepare the schema, e.g. add relation key fields or model operations. |
| 4 | `execute(def)` | same | Core transformation, e.g. filter and mutation inputs, list wrapping, connections. |
| 4b | validate | document | Full `validateSDL` once `execute` has run: every type exists by now, so an unknown type name (a typo, or a type nothing generates) throws here, before any generator runs. Transforming plugins skip a reference they cannot resolve and leave it to this check. |
| 5 | `generate(def)` | same | Code generators collect per-definition output. |
| 6 | `cleanup(def)` | same | Strip utility directives and `@serverOnly`/`@writeOnly` fields from the public SDL. |
| 7 | `after()` | per plugin | Remove internal definitions (directive definitions, internal enums). |
| 7b | validate | document | Full `validateSDL` of the final document, so a plugin that leaves invalid SDL behind (a directive usage whose definition was removed) fails instead of printing it. |
| 8 | output | per plugin | `output.schema = document.print()`. Then each plugin's `output()` return value is `Object.assign`-ed in, and finally `output.files = context.files`. |

Things every plugin author needs to know:

- **Phases are full passes.** Every definition is normalized before any is executed. Within a phase, the outer loop is definitions and the inner loop is plugins in registration order.
- **The definition map is live.** The loops iterate `document.definitions.values()` while plugins add nodes. A node added during a phase is visited later in the same phase if it has not been reached yet, because `Map` iteration includes entries added during iteration.
- **`generate` runs before `cleanup`.** Generators still see utility directives (`@serverOnly`, `@readOnly`, …) and the `@serverOnly @writeOnly` relation key fields. Each generator therefore applies its own visibility rules; see [Field visibility](../guide/field-visibility.md). The flip side is that `output.schema` (printed after `after()`) and what a generator saw during `generate` are different documents.
- **`match()` gates every per-definition hook.** A plugin that implements `normalize` but whose `match` returns false for a node never sees that node.
- **Validation happens once, up front.** Nodes that plugins add are not re-validated. `validateSDL` checks SDL rules only, so directive argument value types are not checked.

## Errors

The error classes are in `packages/shared/src/errors`:

| Error | Raised when |
|---|---|
| `TransformerValidationError` | The merged source fails SDL validation. |
| `InvalidDefinitionError` | A definition-node operation fails, e.g. `getNodeOrThrow` on a missing name, or a duplicate on merge. |
| `TransformerPluginExecutionError` | A plugin rejects a schema. Plugins throw it with their own name. |

## Related

- [Plugin API](./plugin-api.md)
- [Definition nodes](./definition-nodes.md)
- [Known gaps](./known-gaps.md)
- [Configuration](../guide/configuration.md)
