# 0001 — Root `docs/` structure for humans and agents

- **Date:** 2026-09-28
- **Status:** accepted

## Context

Documentation was spread across several places:
- the package READMEs (one real one, the rest stubs);
- `CLAUDE.md`, which held the only architecture description;
- JSDoc, which in places contradicts the code.

`docs/` was empty. A set of upcoming features, several depending on the sibling ORM `dsqlbase`, needs proposals that can name the docs pages they change, so a structure had to exist first. `dsqlbase` already uses a structure that works for the same author and the same agents.

## Decision

- **Three trees under `docs/`:**
  - `guide/` for consumers, describing shipped behaviour only;
  - `internals/` for contributors and agents;
  - `decisions/` for this log.

  The pages are plain markdown with a `README.md` index per directory. There is no site generator yet. The layout mirrors `dsqlbase`.
- **`CLAUDE.md` shrinks** to commands, agent rules and pointers into `docs/internals/`, so humans and agents read the same text. Package READMEs become pointers.
- **Workflow:**
  - Proposals are drafted in `.claude/proposals/` and multi-proposal work is tracked in `.claude/epics/`. Both are untracked.
  - On acceptance, the design moves to `docs/`, a record lands here, and the proposal is deleted.
- **Freshness is enforced by rule, not CI:**
  - a `## Docs` section in every proposal;
  - docs pages named in every story;
  - a `Docs:` line in every changeset.
- **The first pass documents the current state in full,** including a [Known gaps](../internals/known-gaps.md) list, so every later proposal has a baseline to compare against.

Rejected alternatives:
- **A single flat tree:** it mixes audiences.
- **A generated site now:** it adds tooling while the API is still changing.
- **README-only:** READMEs cannot hold internals.
- **Per-package docs:** most topics, such as a directive's effect on every generator, cut across packages.

## Consequences

- Every PR that touches a published package must name docs pages in its changeset.
- The root README stays a showcase and links into `docs/`.
- A static site (e.g. VitePress) can be added later without moving files.
- Nothing enforces the rules in CI. If they are not followed, a check is the next step.

## Docs

- `docs/README.md`
- `docs/internals/conventions.md`, sections Design workflow and Documentation
