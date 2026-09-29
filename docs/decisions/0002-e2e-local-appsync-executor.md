# 0002 — Behavioural end-to-end tests over `example/`, through a local AppSync

- **Date:** 2026-09-29
- **Status:** accepted
- **Proposal:** `foundations.md`

## Context

Every test was a unit test. Each drove one plugin's hooks by hand, so nothing checked that the full preset stack produces an API that works. What gqlbase promises users is behaviour: CRUD, relations, filters, pagination, visibility. The generated files are only the means. The API the example targets runs on AppSync, which cannot run locally.

## Decision

- **Behavioural, not snapshot.** The suite generates the artifacts, attaches resolvers, runs GraphQL operations and asserts on the responses and stored rows. It never compares generated files.
- **The fixture is `example/`.** Its schema covers most use cases and grows with each capability. The suite lives in `example/test/`. There is no separate e2e package and no copy of a consumer schema.
- **A local AppSync.** graphql-js builds `generated/appsync/schema.graphql`, plus a prelude for AppSync's implicit scalars and directives. It validates each operation and walks the selection. Each field that has a resolver goes to the example's middy router as an AppSync Lambda event. One run therefore covers the AppSync SDL, the generated resolver types (through a typecheck) and handlers written the way users write them.
- **PGlite, not a live database.** The example is never deployed, so it runs on an in-memory PGlite database, with a fresh one per spec file.
- **dsqlbase at `latest`.** dsqlbase has no pre-release tags. A capability that needs unreleased dsqlbase work waits for the release.

## Consequences

- A proposal's acceptance criteria are written as behaviours of the example API and land with a spec in the same PR.
- `npm test` runs codegen, a typecheck and the specs, so a PR that breaks generated output for real resolver code fails CI (`.github/workflows/ci.yml`).
- The emulation is partial. AWS scalar validation, auth directives, batching and pipeline resolvers are not reproduced. Behaviours that depend on them need their own approach.
- The example has to contain real resolvers for everything the suite covers.

## Docs

- [Testing → End-to-end tests](../internals/testing.md#end-to-end-tests)
