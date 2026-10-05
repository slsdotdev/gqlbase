---
"@gqlbase/core": minor
"@gqlbase/plugins": minor
---

**Breaking:** dsqlbase stores list fields as `array()` and other object fields as `record()` columns, both `jsonb` (they were `json`), so list filters run. DSQL cannot change a column's type in place: add a column, backfill it, then switch. See [Upgrading existing tables](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/embedded-objects.md#upgrading-existing-tables).

- `@embedded` on an object type stores its fields as a column group (`price_amount`, `price_currency`) through an `embedded({...})` shape. An embedded type cannot be a `@model`, have an `id` or relations, or contain itself through non-list members.
- `@index` and `@unique` name an embedded member by path (`"price.amount"`), and `orderBy` reaches its members.

Read more: [Embedded objects](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/embedded-objects.md).
