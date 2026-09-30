---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
"gqlbase": minor
---

The base plugins move into `@gqlbase/core` and are registered by every transformer, in a fixed order, before the configured plugins. `basePreset()` and the `@gqlbase/plugins/base` / `gqlbase/plugins/base` subpaths are removed; the plugins and their helpers are exported from `@gqlbase/core/plugins`. `isRelayConnection` and `isRelayEdge` also move there. `createTransformer` no longer requires `plugins`.

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
