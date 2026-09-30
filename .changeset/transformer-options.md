---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
"@gqlbase/cli": minor
---

Add transformer options `relay`, `semanticNullability` and `operations`, set under `transform` in the config (next to `plugins`) or at the top level of `createTransformer`, and frozen onto `context.options`. `ModelPlugin` reads `operations` from the context. `RfcFeaturesPlugin`, which declares `@semanticNonNull`, is registered only when `semanticNullability: true`; the default is `false`, so a config whose schema uses the directive must set it.

Docs: docs/guide/configuration.md, docs/guide/models.md, docs/guide/relay.md, docs/internals/plugin-api.md
