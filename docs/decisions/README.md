# Decisions

_Audience: contributors and agents._

These are accepted design decisions, numbered in the order they were accepted. A record is short: enough to know what was decided, why, and what it rules out. The full design lives in [`docs/internals/`](../internals/README.md) and [`docs/guide/`](../guide/README.md). A record is never edited to change a decision; a new record supersedes the old one, and the two link to each other.

## Index

| # | Title | Date | Status |
|---|---|---|---|
| [0001](./0001-docs-structure.md) | Root `docs/` structure for humans and agents | 2026-09-28 | accepted |

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
