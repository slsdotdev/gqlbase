# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

gqlbase is a GraphQL schema transformer and code generator. It reads SDL, expands directives (`@model`, `@hasMany`, …) into operations, inputs and relation types through an ordered plugin pipeline, and generates TypeScript types, Zod validators, ORM schemas (dsqlbase, Drizzle) and an AppSync schema from the result.

## Read first

`docs/` is the single reference, and humans and agents read the same pages. Start at `docs/internals/README.md`, then:

- **How it works:**
  - `docs/internals/architecture.md`: packages and the seven-phase pipeline. Note that `generate` runs before `cleanup`.
  - `docs/internals/plugin-api.md`: the plugin contract and the context.
  - `docs/internals/definition-nodes.md`: the AST wrappers plugins mutate.
- **Before designing anything:**
  - `docs/internals/known-gaps.md`: defects to fix, not design around.
  - `docs/internals/conventions.md`: code style, the proposal workflow, and docs rules.
- **What directives do:**
  - `docs/guide/models.md`
  - `docs/guide/relations.md`
  - `docs/guide/field-visibility.md`
  - `docs/guide/scalars.md`
- **Tests:** `docs/internals/testing.md`.

## Commands

```bash
npm run build          # Build all packages (tsc via Turbo). Tests resolve workspace deps through dist/
npm run dev            # Watch mode for all packages
npm run lint           # ESLint with auto-fix (also runs in the pre-commit hook)
npm run test           # All tests: builds deps first, then unit tests + the example/ e2e suite
npm run coverage       # Test coverage report
npx vitest run packages/core   # One package
npx vitest run path/to/file    # One test file
npm test -w example            # E2E only: codegen, typecheck, specs against PGlite
```

## Code conventions (summary; the full list is in `docs/internals/conventions.md`)

- ES modules throughout, with `.js` extensions in imports. Strict TypeScript with `nodenext` resolution.
- PascalCase for classes (`ModelPlugin`), camelCase for factory exports (`modelPlugin`). Named exports only.
- Prettier: double quotes, semicolons, trailing commas (es5), 100-column print width.
- Errors come from `@gqlbase/shared/errors`. Log through `context.logger` / `logger.createChild(scope)`.
- Tests are co-located as `*.test.ts`. Use explicit `let` + `beforeAll`/`beforeEach` and no helper abstractions.

## Agent rules

- **Proposals and epics.** Non-trivial work starts as a proposal in `.claude/proposals/`; multi-proposal work is tracked in `.claude/epics/`. Both are untracked. Nothing in `docs/` may cite them.
- **Docs are part of done.**
  - A change to documented behaviour updates the doc page in the same change.
  - A fix for a listed gap deletes its entry in `known-gaps.md`.
  - Every changeset carries a `Docs:` line.
- **Changesets.** Every change to a published package gets one (`npm run changeset`). `@gqlbase/*` and `gqlbase` version together as a `fixed` group. CI publishes from `main`.
