# gqlbase documentation

_Audience: everyone. Start here._

This directory is the one reference for `gqlbase`. It serves people using the library and people (and agents) changing it. The pages are plain markdown and can be browsed on GitHub.

## Who reads what

| You are… | Read |
|---|---|
| Using `gqlbase` to transform a schema and generate code | [`guide/`](./guide/README.md) |
| Changing the code, reviewing a PR, or writing a proposal | [`internals/`](./internals/README.md), then [`decisions/`](./decisions/README.md) |
| An agent working in this repo | Start with [`internals/README.md`](./internals/README.md), then read the pages it lists. `CLAUDE.md` at the repo root holds commands and rules. |

## Page map

### Guide (consumers)

- [Guide index](./guide/README.md): what gqlbase does, and the order to read the guide in.
- [Install](./guide/install.md): packages and the CLI.
- [Configuration](./guide/configuration.md): `gqlbase.config.js`, presets, and plugin order.
- [Models](./guide/models.md): `@model`, generated operations, inputs, and filters.
- [Relations](./guide/relations.md): `@hasOne`, `@hasMany`, `@belongsTo`, relation keys, and connections.
- [Field visibility](./guide/field-visibility.md): `@readOnly`, `@writeOnly`, `@serverOnly`, `@clientOnly`, the operation-specific directives, and `@constraint`.
- [Scalars](./guide/scalars.md): built-in scalars, type hints, and custom scalars.
- Generator guides:
  - [Relay](./guide/relay.md)
  - [AppSync](./guide/appsync.md)
  - [Zod](./guide/zod.md)
  - [dsqlbase](./guide/dsqlbase.md)

### Internals (contributors and agents)

- [Architecture](./internals/architecture.md): packages, dependency direction, and the transformer pipeline.
- [Plugin API](./internals/plugin-api.md): `ITransformerPlugin`, the context, factories, and output.
- [Definition nodes](./internals/definition-nodes.md): the mutable AST wrappers every plugin works on.
- [Testing](./internals/testing.md): commands, layout, and test conventions.
- [Known gaps](./internals/known-gaps.md): deficiencies to fix, not to design around.
- [Conventions](./internals/conventions.md): code style, the design workflow, and the documentation definition of done.

### Decisions

- [Index](./decisions/README.md): accepted design records, numbered.

## Page conventions

- Code is cited by path (`packages/core/src/transformer/GraphQLTransformer.ts`), never by line number.
- Every page opens with an `_Audience_` line and ends with `## Related`.
- Stub pages carry a `> **Status: stub**` callout and list what they will contain.
- Pages describe general needs, never a specific consuming application.

[Conventions → Documentation](./internals/conventions.md#documentation) defines how these pages stay current.
