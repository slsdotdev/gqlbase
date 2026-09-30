---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
"gqlbase": minor
---

Relay is a transformer option. `NodeInterfacePlugin` and `ConnectionPlugin` move into `@gqlbase/core` and are registered right after `RelationsPlugin` when `transform.relay` is on. `relayPreset()` and the `@gqlbase/plugins/relay` / `gqlbase/plugins/relay` subpaths are removed.

`ConnectionPlugin` reads `semanticNullability` from the options instead of probing the document. With it on, `edges` and `XEdge.node` carry `@semanticNonNull`; with it off, they are plain non-null (`edges: [XEdge!]!`, `node: X!`). Previously `node` was always nullable.

Migration: replace `relayPreset()` with `transform: { relay: true }`.

Docs: docs/guide/relay.md, docs/guide/configuration.md, docs/internals/architecture.md, docs/internals/known-gaps.md
