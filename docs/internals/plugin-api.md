# Plugin API

_Audience: contributors and agents writing or changing plugins._

Every behaviour in gqlbase is a plugin. This page is the contract. The code is in `packages/core/src/plugins/` and `packages/core/src/context/`.

## `ITransformerPlugin`

`packages/core/src/plugins/ITransformerPlugin.ts`

| Member | Required | Called |
|---|---|---|
| `name` | yes | Must be unique. `TransformerContext.registerPlugin` throws on a duplicate. |
| `context` | yes | The shared `ITransformerContext`. |
| `init()` | yes | Once, at registration. Put definitions the plugin owns on `context.base` here. |
| `match(definition)` | yes | Before every per-definition hook. Returns true when the plugin wants to handle that definition. |
| `before?()` | no | Once, after the document is merged and validated. |
| `normalize?(def)` | no | Per matching definition, phase 3. |
| `execute?(def)` | no | Per matching definition, phase 4. |
| `generate?(def)` | no | Per matching definition, phase 5, which runs before cleanup. |
| `cleanup?(def)` | no | Per matching definition, phase 6. |
| `after?()` | no | Once, after cleanup. |
| `output?()` | no | Once, last. Returns `Record<string, unknown>`, which is merged into `TransformerOutput`. |

[Architecture → The transformer pipeline](./architecture.md#the-transformer-pipeline) covers phase ordering and its consequences.

## `TransformerPluginBase`

`packages/core/src/plugins/TransformerPluginBase.ts` is an abstract class. Its constructor is `(name, context)`, `init()` does nothing, and `match()` returns `false`. Extend it and override only the hooks you need.

## Factories and options

`createPluginFactory(Ctor)` (`packages/core/src/plugins/createPluginFactory.ts`) turns a class whose constructor is `(context, options?)` into a factory function `(options?) => IPluginFactory`. `IPluginFactory` is `{ create(context): ITransformerPlugin }` (`packages/core/src/plugins/IPluginFactory.ts`).

Conventions:
- **Naming.** The class is PascalCase (`ModelPlugin`); the factory export is camelCase (`modelPlugin`).
- **Option defaults.** Plugins with options keep a `DEFAULT_OPTIONS` constant and a `mergeOptions` in their `*.utils.ts`. Examples are `ZodSchemaGeneratorPlugin` and `DsqlBaseSchemaGeneratorPlugin`.
- **Presets.** A preset is a function that returns `IPluginFactory[]`, e.g. `packages/plugins/src/appsync/appSyncPreset.ts`. `createTransformer` flattens nested arrays, so presets and single factories mix freely in a config.

## The context

The interface is `packages/core/src/context/ITransformerContext.ts` and the implementation is `packages/core/src/context/TransformerContext.ts`.

| Member | Use |
|---|---|
| `options: Readonly<TransformerOptions>` | The transformer options (`relay`, `semanticNullability`, `operations`), resolved with their defaults and frozen (`packages/core/src/context/TransformerOptions.ts`). Read them here to decide what to generate; do not probe the document for a directive definition. |
| `base: DocumentNode` | Definitions the plugin contributes: directive definitions, internal enums, built-in scalars. It is merged with the user's source at `startWork`. A name that appears in both throws. |
| `document: DocumentNode` | The working document. It exists only between `startWork` and `finishWork`; reading it outside that window throws. Plugins mutate it in place. |
| `files: FileArtifact[]` | Generated files: `{ type, path, filename, content }`, where `path` is relative to the configured output directory. Like `document`, it is only valid during work. |
| `plugins: ITransformerPlugin[]` | Every registered plugin, in order. Nothing in the repo uses it to find another plugin yet, and there is no lookup helper or shared metadata store. |
| `logger` | A scoped logger from `@gqlbase/shared/logger`. Use `logger.createChild(scope)`. |
| `registerPlugin`, `startWork`, `finishWork` | Used by `createTransformer` and `GraphQLTransformer`. Registering after work has started throws. Tests call `startWork`/`finishWork` directly (see [Testing](./testing.md)). |

## Depending on other plugins

The core plugins (`packages/core/src/plugins/`, listed in `corePlugins.ts`) are registered before any configured plugin. Feature plugins among them (`RfcFeaturesPlugin`, `NodeInterfacePlugin`, `ConnectionPlugin`) are registered only when their option is on, so check `context.options` rather than assuming their definitions exist. A plugin may rely on what they add and import their helpers (`isModel`, `isRelationField`, `isSemanticNullable`, `isRelayConnection`, …) from `@gqlbase/core/plugins`.

A plugin must not depend on an optional plugin, because a config can leave it out: capability plugins in `@gqlbase/plugins` never import each other. If two of them need the same helper, move it into core.

## Declaring directives

A plugin that owns a directive declares it in `init()`:

```ts
public init() {
  this.context.base.addNode(
    DirectiveDefinitionNode.create("model", undefined, ["OBJECT"], /* args */)
  );
}
```

It then removes the directive's usages in `cleanup` and its definition in `after`, so the public schema carries neither. Examples include `packages/core/src/plugins/UtilitiesPlugin/UtilitiesPlugin.ts` and `packages/core/src/plugins/ModelPlugin/ModelPlugin.ts`. `RfcFeaturesPlugin` keeps `@semanticNonNull` in the output on purpose, and is registered only when `context.options.semanticNullability` is on.

Internal-only definitions carry `@gqlbase_internal`. Scalars carry `@gqlbase_typehint(type: …)` to tell generators how to type them. Both come from `InternalUtilsPlugin` (`packages/core/src/plugins/InternalUtilsPlugin/`), which removes them in `cleanup` and `after`. Internal definitions never reach the client schema, so `SchemaGeneratorPlugin` removes any that are left before printing.

## Producing files

Generators accumulate state during `generate` (and sometimes `before`/`after`). In `output()` they push to `context.files` and may return extra keys. `SchemaGeneratorPlugin` (`packages/core/src/plugins/SchemaGeneratorPlugin/SchemaGeneratorPlugin.ts`) is the smallest example: it pushes `schema.graphql` and returns `{ schema }`. TypeScript generators print through the `typescript` factory API; the shared base is `packages/core/src/plugins/TypesGeneratorBase/TypesGeneratorBase.ts`.

## Writing a plugin: checklist

1. Extend `TransformerPluginBase`, pass a unique name, and export a factory made with `createPluginFactory`.
2. Declare the plugin's directives, enums and scalars on `context.base` in `init()`.
3. Keep `match()` narrow. It gates every per-definition hook. Read `context.options` for feature switches.
4. Add schema in `normalize`, transform in `execute`, and collect generated output in `generate`. Anything that depends on another plugin's work must run in a later phase than that work.
   A generator that describes the client schema must leave out what will not reach it: use `isPublicSchemaField(field, parent)` for fields and `collectPublicDefinitions(context)` for definitions (collect once, on the first `generate` call). A generator that describes stored data uses `collectReachableDefinitions` with its own field rule.
5. Remove the plugin's directives and temporary fields in `cleanup`, and its definitions in `after`.
6. Co-locate `<Plugin>.test.ts` (see [Testing](./testing.md)). If the plugin adds or changes documented behaviour, update the guide page in the same PR ([Conventions → Documentation](./conventions.md#documentation)).

## Related

- [Architecture](./architecture.md)
- [Definition nodes](./definition-nodes.md)
- [Configuration](../guide/configuration.md)
