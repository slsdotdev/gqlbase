---
"@gqlbase/core": patch
---

An interface whose fields are all `@serverOnly` or `@writeOnly`, such as one sharing storage keys between models, is no longer printed empty. It is removed from the output schema and from its implementors' `implements` lists, and gets no AppSync resolver type. The schema types and Zod still generate it, and its implementors keep its fields as hidden fields. A public field that returns such an interface now throws, since the client would have no field to select. Mark the field `@serverOnly` instead. The new `hasPublicFields` helper is exported from `@gqlbase/core/plugins`.

The Zod guide now says which schema guards which boundary, and that object schemas drop the keys they do not declare.

Read more: [Field visibility → On an interface](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/field-visibility.md#on-an-interface), [Zod → Which schema guards what](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/zod.md#which-schema-guards-what), [Data sources](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/data-sources.md).
