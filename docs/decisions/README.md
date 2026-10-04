# Decisions

_Audience: contributors and agents._

These are accepted design decisions, numbered in the order they were accepted. A record is short: enough to know what was decided, why, and what it rules out. The full design lives in [`docs/internals/`](../internals/README.md) and [`docs/guide/`](../guide/README.md). A record is never edited to change a decision; a new record supersedes the old one, and the two link to each other.

## Index

| # | Title | Date | Status |
|---|---|---|---|
| [0001](./0001-docs-structure.md) | Root `docs/` structure for humans and agents | 2026-09-28 | accepted |
| [0002](./0002-e2e-local-appsync-executor.md) | Behavioural end-to-end tests over `example/`, through a local AppSync | 2026-09-29 | accepted |
| [0003](./0003-core-plugins-and-transformer-options.md) | Core plugins, transformer options, and a schema that matches its types | 2026-09-30 | accepted |
| [0004](./0004-filters-ordering-and-relation-keys.md) | One filter vocabulary, `orderBy` maps, and relation keys only between stored types | 2026-10-02 | accepted |
| [0005](./0005-tenancy-scopes.md) | Tenancy scopes in config, claims as `@serverOnly` fields | 2026-10-02 | accepted |
| [0006](./0006-resolver-typings.md) | Schema types as parts; AppSync types under the API's names; `@computed` | 2026-10-03 | accepted |
| [0007](./0007-global-ids.md) | Global ids through a `GUID` scalar | 2026-10-04 | accepted |
| [0008](./0008-polymorphic-relations.md) | Polymorphic relations: a hidden discriminator, unions and interfaces alike | 2026-10-04 | accepted |
| [0009](./0009-embedded-objects.md) | Embedded objects: opt-in column groups, documents on jsonb | 2026-10-04 | accepted |
| [0010](./0010-tenant-scope-emission.md) | Tenancy scopes as dsqlbase `tenantScope` | 2026-10-04 | accepted |

## Template

```markdown
# NNNN — Title

- **Date:** YYYY-MM-DD
- **Status:** accepted | superseded by [NNNN](./NNNN-title.md)
- **Proposal:** `<name>.md` — the working proposal under `.claude/`, which is untracked; name it for the author's reference and keep this record self-contained

## Context
Why a decision was needed. Two to five sentences.

## Decision
What was decided. Bullets are fine.

## Consequences
What this enables, what it forecloses, and what it costs. Include breaking changes and the changeset level.

## Docs
Which `docs/internals/` and `docs/guide/` pages carry the design.
```

## Related

- [Conventions → Design workflow](../internals/conventions.md#design-workflow)
