---
"gqlbase": minor
---

0.2.0 moves the base and Relay plugins into core, adds transformer options under `transform`, and changes the generated file layout. Migrate a config like this:

```diff
- import { basePreset, relayPreset, appsyncPreset } from "gqlbase/plugins";
+ import { appsyncPreset } from "gqlbase/plugins";

  export default defineConfig({
+   transform: { relay: true, semanticNullability: true, operations: ["read"] },
-   plugins: [basePreset({ operations: ["read"] }), relayPreset(), appsyncPreset()],
+   plugins: [appsyncPreset()],
  });
```

Then update imports of generated files: `models.typegen` → `schema.types`, `dsqlbase.schema` → `dsqlbase/schema`, `appsync/middy-appsync.typegen` → `appsync/middy-appsync.types`. The full list of changes is in the migration guide.

Docs: docs/guide/configuration.md#migrating-from-01, docs/decisions/0003-core-plugins-and-transformer-options.md
