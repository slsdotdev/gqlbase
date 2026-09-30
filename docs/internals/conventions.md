# Conventions

_Audience: contributors and agents._

## Tooling

- **Package manager:** `npm` / `npx`, with npm workspaces. Turborepo orchestrates `build`, `test`, `lint` and `dev` (`turbo.json`).
- **TypeScript:** strict, `module`/`moduleResolution: "nodenext"`, ES modules everywhere (`"type": "module"`). Imports use explicit `.js` extensions, even from `.ts` files.
- **Formatting and lint:** Prettier (`.prettierrc`: double quotes, semicolons, `trailingComma: "es5"`, 100-column print width) and one flat ESLint config (`eslint.config.mjs`). Husky runs `npm run lint` before every commit; do not bypass it.
- **Changesets:** every change to a published package gets a changeset (`npm run changeset`). Never edit `version` by hand. `@gqlbase/*` and `gqlbase` are one `fixed` group, so they always release together.
- **CI:** `.github/workflows/release.yml` builds, lints, tests and publishes on pushes to `main`. There is no pull-request workflow yet ([Known gaps](./known-gaps.md)).
- **Branches:** work on a branch off `main`. `main` is the release branch.

## Code conventions

- **Naming:** classes are PascalCase (`ModelPlugin`); factory exports are camelCase (`modelPlugin`); presets are `<name>Preset()`.
- **Exports:** named exports only, no default exports. Each plugin directory has an `index.ts` that exports the class, its factory, and whatever public utils it has.
- **Plugin layout:** `<Plugin>/<Plugin>.ts`, `<Plugin>.utils.ts` (constants, directive names, predicates, `DEFAULT_OPTIONS` / `mergeOptions`), `<Plugin>.test.ts` and `index.ts`.
- **Directive names:** keep them in a constant object in the owning plugin's utils (e.g. `UtilityDirective`, `RelationDirective`), never as string literals scattered through other plugins.
- **Errors:** throw the classes from `@gqlbase/shared/errors`. A plugin rejecting a schema throws `TransformerPluginExecutionError` with its own name.
- **Logging:** use `context.logger`, or a child from `logger.createChild(scope)`. Do not use `console`.
- **Mutation:** mutate definition nodes in place through their methods ([Definition nodes](./definition-nodes.md)). Do not rebuild graphql-js AST by hand.

## Design workflow

1. **Proposal first.** Non-trivial work starts as `.claude/proposals/<name>.md`. A proposal states:
   - the problem;
   - the current state, citing code by path;
   - any dependency on other libraries;
   - the options, including rejected alternatives;
   - the decision;
   - the stories;

   and ends with a `## Docs` section (see [Documentation](#documentation) below).
2. **Decisions are made together.** A proposal stays `status: draft` until its open questions are answered. A requested feature is an input to the design, not the design itself.
3. **Gaps are prerequisites.** If a feature needs something in [Known gaps](./known-gaps.md) fixed, that fix is a prerequisite story in the proposal. Do not bend the feature to avoid it.
4. **Epics** hold multi-proposal work and live in `.claude/epics/<name>.md`. An epic fixes the delivery order, records dependencies on other libraries (e.g. dsqlbase builders that must ship first), and tracks what shipped against what was proposed.
5. **Proposals and epics are untracked.** `.gitignore` excludes `.claude/prime`, `.claude/proposals` and `.claude/epics`. They are working notes that go stale the moment the code lands. Nothing outside `.claude/` may depend on them. A decision record may name its proposal for the author's reference, but must stand on its own.
6. **On acceptance:**
   - the durable design text moves into `docs/internals/` (and `docs/guide/` for user-facing behaviour);
   - a condensed record is added to [`docs/decisions/`](../decisions/README.md);
   - the proposal file is deleted.

   Carry the rejected alternatives across first; they have no other home.
7. **Breaking changes are named.** While the library is `0.x`, a breaking change is a minor bump. Say so in the proposal and the changeset, and batch breaking changes into one release where possible.

## Documentation

`docs/` is the single reference for consumers, contributors and agents. These rules apply to every proposal, story and PR:

1. **Every proposal ends with a `## Docs` section.** It lists:
   - the `docs/guide/` pages to add or change;
   - the `docs/internals/` pages to add or change;
   - the decision record to add once accepted;
   - any `CLAUDE.md` or package README lines that become stale.
2. **Every implementation story names the docs pages it changes.** A story is not done until those pages are updated in the same PR.
3. **Every changeset body carries a `Docs:` line.** It names the pages touched, or says `Docs: none — <reason>`.
4. **A change that alters a documented claim fixes the doc in the same change.** This includes the [Known gaps](./known-gaps.md) entry it closes.

Page rules:

- Every page opens with an `_Audience_` line and ends with `## Related`.
- Cite code by path (`packages/core/src/plugins/ModelPlugin/ModelPlugin.ts`), never by line number.
- The guide describes shipped behaviour only. Planned behaviour belongs in proposals.
- Stubs carry `> **Status: stub**` and list their intended contents.
- Nothing consumer-specific: describe needs in general terms, never by application name.

## Related

- [Testing](./testing.md)
- [Architecture](./architecture.md)
- [Decisions](../decisions/README.md)
