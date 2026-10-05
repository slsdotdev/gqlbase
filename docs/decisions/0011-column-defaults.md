# 0011 — Column defaults: dsqlbase directives, a core "filled on create" marker

- **Date:** 2026-10-05
- **Status:** accepted
- **Proposal:** `dsql-column-defaults.md`

## Context

The dsqlbase generator emitted no defaults: only `id` had `.defaultRandom()`. Every create and update resolver set timestamps and flags by hand, and a `@readOnly` non-null field it forgot failed the insert. dsqlbase has `.default(value)`, `.defaultNow()` on `timestamp`, `.defaultRandom()` on `uuid`/`guid`, and client hooks `$onCreate` / `$onUpdate`, the only way to set a value on update, since DSQL has no triggers. A writable field with a default should also be optional in the create input, which core builds, and in the Zod create schema, which follows it.

## Decision

- **Three dsqlbase plugin directives**, mirroring the builders: `@defaultNow`, `@defaultRandom` and `@default(value:, onCreate:, onUpdate:)`. The arguments are TypeScript, emitted as written, parsed at transform time.
- **Core knows one fact through an internal marker**, `@gqlbase_hasDefault`: the server fills the field when a create leaves it out. The dsqlbase plugin sets it in `normalize` for a database default or `onCreate`; `ModelPlugin` makes the field optional in the model's create input. Nested `<Type>Input`s, shared with updates, keep their nullability.
- **The Zod create schema follows the input**: a non-null field the create input leaves optional is `.optional()`.
- At most one database default per field; `id` takes only `@defaultRandom`; an `@embedded` group takes only `@default(value:)`.

Rejected:
- `@default` in core: its arguments are dsqlbase builder code, meaningless to other backends. Core only needs "filled on create", which another backend can set too.
- JSON values for `value`: they cannot express a function or a non-JSON value; TypeScript can, and the generated file's typecheck checks it.
- Making `onUpdate`-only fields optional on create: the hook does not run on insert.

## Consequences

- `minor`, additive: no default is emitted unless declared.
- `Create<Model>InputSchema` now makes a field `.optional()` whenever the create input does; before this, no non-null field was optional there except `id`.
- Hooks run only through the dsqlbase client; rows written with raw SQL get database defaults only.

## Docs

- [dsqlbase → Column defaults](../guide/dsqlbase.md#column-defaults)
- [Models → Mutation inputs](../guide/models.md#mutation-inputs), [Zod](../guide/zod.md), [Plugin API](../internals/plugin-api.md)
