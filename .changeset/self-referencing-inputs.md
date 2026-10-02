---
"@gqlbase/core": patch
---

A non-model object type that refers to itself (`type PricingModel { floor: PricingModel }`) no longer overflows the stack when it is used in a model's mutation inputs: the nested reference reuses `PricingModelInput`.

Docs: none, no documented behaviour changes.
