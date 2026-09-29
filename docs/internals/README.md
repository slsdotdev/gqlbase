# Internals

_Audience: contributors and agents._

These pages describe how gqlbase works inside: the transformer pipeline, the plugin contract, the definition node model, and the rules for changing any of them. What the library offers to consumers is in [`../guide/`](../guide/README.md).

## Reading order

1. [Architecture](./architecture.md): packages, how they depend on each other, and the seven-phase pipeline.
2. [Plugin API](./plugin-api.md): what a plugin can hook into and what it can reach through the context.
3. [Definition nodes](./definition-nodes.md): the AST wrappers plugins read and mutate.
4. [Testing](./testing.md): how to run and write tests.
5. [Known gaps](./known-gaps.md): read this before designing anything. It lists defects to fix first.
6. [Conventions](./conventions.md): code style, the proposal workflow, and the docs rules.

## Related

- [Docs index](../README.md)
- [Decisions](../decisions/README.md)
