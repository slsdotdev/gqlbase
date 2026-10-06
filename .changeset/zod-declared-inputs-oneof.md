---
"@gqlbase/plugins": patch
---

Zod: a hand-written mutation input that retypes a field, such as a relation written through a nested create input (`schedule: CreateEmployeeScheduleInput!`), now references that input's schema instead of the related model's output schema. The input schemas a generated schema references are emitted without `generateArgumentSchemas`. A `@oneOf` input becomes a union of single-field strict objects.

Read more: [Zod](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/zod.md).
