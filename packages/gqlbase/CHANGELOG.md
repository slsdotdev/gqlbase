# gqlbase

## 0.2.0

### Minor Changes

- af89b97: The base plugins move into `@gqlbase/core` and are registered by every transformer, in a fixed order, before the configured plugins. `basePreset()` and the `@gqlbase/plugins/base` / `gqlbase/plugins/base` subpaths are removed; the plugins and their helpers are exported from `@gqlbase/core/plugins`. `isRelayConnection` and `isRelayEdge` also move there. `createTransformer` no longer requires `plugins`.

  Migration: remove `basePreset()` from `plugins`, and move `basePreset({ operations })` to `transform: { operations }`.

  ```diff
  - import { basePreset, relayPreset } from "gqlbase/plugins";
  + import { relayPreset } from "gqlbase/plugins";

    export default defineConfig({
  -   plugins: [basePreset({ operations: ["read"] }), relayPreset()],
  +   transform: { operations: ["read"] },
  +   plugins: [relayPreset()],
    });
  ```

  Docs: docs/guide/configuration.md, docs/internals/architecture.md, docs/internals/plugin-api.md, docs/guide/models.md, docs/guide/relations.md, docs/guide/install.md

- af89b97: 0.2.0 moves the base and Relay plugins into core, adds transformer options under `transform`, and changes the generated file layout. Migrate a config like this:

  ```diff
  - import { basePreset, relayPreset, appsyncPreset } from "gqlbase/plugins";
  + import { appsyncPreset } from "gqlbase/plugins";

    export default defineConfig({
  +   transform: { relay: true, semanticNullability: true, operations: ["read"] },
  -   plugins: [basePreset({ operations: ["read"] }), relayPreset(), appsyncPreset()],
  +   plugins: [appsyncPreset()],
    });
  ```

  Then update imports of generated files: `models.typegen` → `schema.types`, `dsqlbase.schema` → `dsqlbase/schema`, `appsync/middy-appsync.typegen` → `appsync/middy-appsync.types`. The Zod create/update schemas now match the GraphQL inputs, so resolvers validate `args.input` and add server-set values afterwards. The full list of changes is in the migration guide.

  Docs: docs/guide/configuration.md#migrating-from-01, docs/decisions/0003-core-plugins-and-transformer-options.md

- af89b97: Relay is a transformer option. `NodeInterfacePlugin` and `ConnectionPlugin` move into `@gqlbase/core` and are registered right after `RelationsPlugin` when `transform.relay` is on. `relayPreset()` and the `@gqlbase/plugins/relay` / `gqlbase/plugins/relay` subpaths are removed.

  `ConnectionPlugin` reads `semanticNullability` from the options instead of probing the document. With it on, `edges` and `XEdge.node` carry `@semanticNonNull`; with it off, they are plain non-null (`edges: [XEdge!]!`, `node: X!`). Previously `node` was always nullable.

  Migration: replace `relayPreset()` with `transform: { relay: true }`.

  Docs: docs/guide/relay.md, docs/guide/configuration.md, docs/internals/architecture.md, docs/internals/known-gaps.md

### Patch Changes

- 42ba5e5: Fix the `gqlbase` meta-package: add the `"."` export, the `gqlbase/config` and `gqlbase/plugins[/<name>]` re-exports documented in its README, and the `gqlbase` binary.

  Docs: `docs/guide/install.md` now recommends `gqlbase`; the gap is removed from `docs/internals/known-gaps.md`.

- Updated dependencies [5328484]
- Updated dependencies [226e3b2]
- Updated dependencies [512c76e]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [af89b97]
- Updated dependencies [e656207]
- Updated dependencies [5328484]
- Updated dependencies [e656207]
- Updated dependencies [917368b]
- Updated dependencies [400be01]
- Updated dependencies [226e3b2]
- Updated dependencies [c186041]
- Updated dependencies [c186041]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [af89b97]
- Updated dependencies [af89b97]
- Updated dependencies [5328484]
- Updated dependencies [512c76e]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [af89b97]
- Updated dependencies [226e3b2]
- Updated dependencies [af89b97]
- Updated dependencies [512c76e]
- Updated dependencies [e656207]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [a34bc19]
- Updated dependencies [af89b97]
- Updated dependencies [af89b97]
- Updated dependencies [c186041]
- Updated dependencies [c186041]
- Updated dependencies [2a90a30]
- Updated dependencies [2a90a30]
- Updated dependencies [226e3b2]
  - @gqlbase/plugins@0.2.0
  - @gqlbase/core@0.2.0
  - @gqlbase/cli@0.2.0
  - @gqlbase/shared@0.2.0

## 0.1.11

### Patch Changes

- Updated dependencies [66f689e]
  - @gqlbase/plugins@0.1.11
  - @gqlbase/cli@0.1.11
  - @gqlbase/core@0.1.11
  - @gqlbase/shared@0.1.11

## 0.1.10

### Patch Changes

- Updated dependencies [09b33a7]
  - @gqlbase/plugins@0.1.10
  - @gqlbase/cli@0.1.10
  - @gqlbase/core@0.1.10
  - @gqlbase/shared@0.1.10

## 0.1.9

### Patch Changes

- Updated dependencies [2fe3339]
  - @gqlbase/plugins@0.1.9
  - @gqlbase/cli@0.1.9
  - @gqlbase/core@0.1.9
  - @gqlbase/shared@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [25c27f1]
  - @gqlbase/plugins@0.1.8
  - @gqlbase/cli@0.1.8
  - @gqlbase/core@0.1.8
  - @gqlbase/shared@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [ff979f8]
  - @gqlbase/plugins@0.1.7
  - @gqlbase/cli@0.1.7
  - @gqlbase/core@0.1.7
  - @gqlbase/shared@0.1.7

## 0.1.6

### Patch Changes

- 18da481: Update deps
- Updated dependencies [c677464]
- Updated dependencies [18da481]
  - @gqlbase/plugins@0.1.6
  - @gqlbase/shared@0.1.6
  - @gqlbase/cli@0.1.6
  - @gqlbase/core@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [c265909]
  - @gqlbase/plugins@0.1.5
  - @gqlbase/cli@0.1.5
  - @gqlbase/core@0.1.5
  - @gqlbase/shared@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [cd20bc5]
  - @gqlbase/plugins@0.1.4
  - @gqlbase/cli@0.1.4
  - @gqlbase/core@0.1.4
  - @gqlbase/shared@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [ef8127f]
- Updated dependencies [5c99042]
  - @gqlbase/plugins@0.1.3
  - @gqlbase/cli@0.1.3
  - @gqlbase/core@0.1.3
  - @gqlbase/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [feca490]
  - @gqlbase/plugins@0.1.2
  - @gqlbase/core@0.1.2
  - @gqlbase/cli@0.1.2
  - @gqlbase/shared@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [06cd90b]
- Updated dependencies [72052ff]
  - @gqlbase/plugins@0.1.1
  - @gqlbase/cli@0.1.1
  - @gqlbase/core@0.1.1
  - @gqlbase/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [24f07c8]
  - @gqlbase/plugins@0.1.0
  - @gqlbase/shared@0.1.0
  - @gqlbase/core@0.1.0
  - @gqlbase/cli@0.1.0

## 0.0.10

### Patch Changes

- Updated dependencies [cbd7391]
  - @gqlbase/plugins@0.0.10
  - @gqlbase/shared@0.0.10
  - @gqlbase/core@0.0.10
  - @gqlbase/cli@0.0.10

## 0.0.9

### Patch Changes

- Updated dependencies [ec95c9c]
  - @gqlbase/shared@0.0.9
  - @gqlbase/cli@0.0.9
  - @gqlbase/core@0.0.9
  - @gqlbase/plugins@0.0.9

## 0.0.8

### Patch Changes

- Updated dependencies [2f3cc44]
- Updated dependencies [2f3cc44]
  - @gqlbase/plugins@0.0.8
  - @gqlbase/cli@0.0.8
  - @gqlbase/core@0.0.8
  - @gqlbase/shared@0.0.8

## 0.0.7

### Patch Changes

- Updated dependencies [309082b]
- Updated dependencies [309082b]
- Updated dependencies [309082b]
- Updated dependencies [309082b]
- Updated dependencies [309082b]
- Updated dependencies [309082b]
  - @gqlbase/plugins@0.0.7
  - @gqlbase/core@0.0.7
  - @gqlbase/cli@0.0.7
  - @gqlbase/shared@0.0.7

## 0.0.6

### Patch Changes

- dc22a95: Add README files for all packages
- Updated dependencies [dc22a95]
  - @gqlbase/core@0.0.6
  - @gqlbase/cli@0.0.6
  - @gqlbase/plugins@0.0.6
  - @gqlbase/shared@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [acf3f62]
- Updated dependencies [41852e8]
- Updated dependencies [a53c785]
  - @gqlbase/plugins@0.0.5
  - @gqlbase/cli@0.0.5
  - @gqlbase/core@0.0.5
  - @gqlbase/shared@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [deb9567]
  - @gqlbase/plugins@0.0.4
  - @gqlbase/cli@0.0.4
  - @gqlbase/core@0.0.4
  - @gqlbase/shared@0.0.4
