---
"@gqlbase/core": minor
---

Core: an internal `@gqlbase_hasDefault` marker for fields the server fills on create. `ModelPlugin` makes a marked model field optional in `Create<Model>Input`; it stays non-null in the output type. Storage plugins set it for the defaults they declare.

Docs: docs/guide/models.md#mutation-inputs
