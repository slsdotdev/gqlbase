# Testing

_Audience: contributors and agents._

## Commands

Run from the repo root:

| Command | Purpose |
|---|---|
| `npm test` | Runs `turbo run test`: builds the workspace dependencies (`^build`), then runs every workspace's `test` script, including the `example/` end-to-end suite. |
| `npm run coverage` | Same, with `--coverage`. Reports land in `coverage/<package>`. |
| `npm run lint` | ESLint with auto-fix. It also runs in the Husky pre-commit hook (`.husky/pre-commit`). |
| `npm run build` | Builds every package with `tsc`, in dependency order (`^build`). |
| `npm run typecheck` | Runs `turbo run typecheck`: `tsc` over each package **including its tests** (`tsconfig.typecheck.json`), and over `example/` after codegen. `build` excludes `*.test.ts` and vitest does not type-check, so this is the only check on test files. |
| `npx vitest run packages/<pkg>` | One package. |
| `npx vitest run path/to/file.test.ts` | One file. |
| `npx vitest run -t "name"` | One test, by name. |
| `npm test -w example` | The end-to-end suite only: codegen, typecheck, then the specs. |

**Tests run against `dist/`.** Tests import sibling packages by their published name (`@gqlbase/core`, `@gqlbase/core/definition`, `@gqlbase/shared/...`), which resolve through each package's `exports` to `dist/`. `npm test` builds dependencies first (the turbo `test` task depends on `^build`). When you call `npx vitest` directly, run `npm run build` after changing `core`, `shared` or `plugins`.

## Layout

- The root `vitest.config.ts` defines one project rooted at `./packages`. Each package has its own `vitest.config.ts`: node environment, globals, and coverage written to `../../coverage/<pkg>`.
- Unit tests sit next to the code they test (`Foo.ts` / `Foo.test.ts`):
  - **core:** every definition node, `TransformerContext`, `GraphQLTransformer`, and `createPluginFactory`.
  - **plugins:** one `<Plugin>.test.ts` per plugin directory. `ScalarsPlugin` and a few others have none.
  - **shared:** string, logger and util helpers.
  - **cli:** the watcher.
- End-to-end specs live in `example/test/` (see [End-to-end tests](#end-to-end-tests)).
- CI runs build → lint → typecheck → test on every pull request (`.github/workflows/ci.yml`) and again on pushes to `main` before publishing (`.github/workflows/release.yml`).

## How plugin tests are written

Plugin tests drive the hooks by hand instead of going through `createTransformer`. Use `packages/core/src/plugins/ModelPlugin/ModelPlugin.test.ts` as the reference for which hooks to call. Existing tests create the context at module scope; new tests should use the `let` + `beforeAll` form below.

```ts
const document = DocumentNode.fromSource(/* GraphQL */ `...`);

describe("ModelPlugin", () => {
  let context: TransformerContext;
  let plugin: ModelPlugin;

  beforeAll(() => {
    context = new TransformerContext();
    plugin = new ModelPlugin(context);
    context.registerPlugin(plugin);   // calls init()
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(document);      // merges base + source
  });

  it("creates list query", () => {
    plugin.before();
    plugin.normalize(context.document.getNodeOrThrow("Model"));
    expect(context.document.getQueryNode().hasField("listModels")).toBe(true);
  });
});
```

Generator tests assert on the emitted source string, e.g. `expect(output).toContain('price: json("price")…')`.

Driving hooks by hand skips the rest of the pipeline. A generator that depends on hook order, for example on `cleanup` having removed `@gqlbase_typehint` before `output()`, needs a test through `createTransformer({ plugins: [...] }).transform(source)` as well. The `*.scalars.test.ts` files are examples.

**A `beforeAll` that throws does not fail the run.** Vitest reports every test in its `describe` as skipped. When a new test file shows skipped tests you did not mark `it.skip`, the setup threw; run the file with `--reporter=verbose` to see which.

## End-to-end tests

The end-to-end suite checks what gqlbase promises users: that an API built on the generated artifacts behaves as documented. It runs against `example/`, a schema that covers most use cases and grows with each capability.

`npm test -w example` (and therefore `npm test`) does three things:

1. **Generates** the artifacts with the example config (`gqlbase`, writing `example/generated/`).
2. **Typechecks** the example (`npm run typecheck -w example`, which is codegen plus `tsc --noEmit`). The resolvers are typed by the generated `appsync/middy-appsync.types.ts` and the generated dsqlbase schema, so a generated type that no longer fits real resolver code fails here.
3. **Runs the specs** (`vitest run`, `example/vitest.config.ts`).

### How an operation runs

AppSync cannot run locally, so `example/test/appsync.ts` stands in for it:

- graphql-js builds the schema from `example/generated/appsync/schema.graphql`. AppSync declares the `AWS*` scalars and `@aws_*` directives implicitly, so a prelude adds them.
- `execute(source, { variables, identity })` validates the operation and walks the selection like AppSync would. `cognitoIdentity(sub, groups, claims)` builds a Cognito identity; `claims` adds token claims such as `custom:vendor_id`, which the example's tenancy resolvers read (`example/src/lib/claims.ts`).
- Each field that has a resolver in `example/src/resolvers/` is sent to the example's middy router (`example/src/index.ts`) as an AppSync Lambda event, with `arguments`, `source`, `identity`, `info` and `stash`. Every other field reads the property off its parent.
- A resolver error comes back as a GraphQL error with `extensions.errorType`. The router masks errors that are not middy `GraphQLError`s as `InternalServerError`, with a generic message.

### Database

The example is never deployed. `example/src/lib/dsql.ts` creates a dsqlbase client on an in-memory PGlite database (`dsqlbase/pglite`). `migrate()` applies the generated dsqlbase schema, with `asyncIndexes: false` because PGlite has no async indexes. Vitest isolates modules per file, so each spec file gets its own empty database. Seed data directly through `dsql` in `beforeAll` when a spec needs rows it is not testing the creation of.

The example depends on `dsqlbase@latest`.

### Adding a capability behaviour

1. Extend the example schema (`example/src/schema/`) with what the capability needs, in a realistic place.
2. Add or extend resolvers in `example/src/resolvers/` and register them in `example/src/resolvers/index.ts`.
3. Add a spec in `example/test/<capability>.test.ts`. Each spec states a behaviour ("filters a `@hasMany` connection"), runs a GraphQL operation and asserts on the response or on the stored rows. Use the `let` + `beforeAll` pattern and no helpers beyond `execute`.

Write a proposal's acceptance criteria as behaviours of this kind.

## Conventions

- **No test helper abstractions.** Use the explicit `let` + `beforeAll`/`beforeEach` pattern shown above. Do not build shared factories or builders that hide the plugin setup.
- **Declare every plugin whose directives the schema uses.** A plugin under test whose schema uses another plugin's directive (`@serverOnly`, `@semanticNonNull`) must register that plugin too, or declare the directive in the source. Otherwise the merged document is invalid.
- **Mutations leak between tests unless you re-parse.** `startWork` merges by reference ([Definition nodes → Mutation rules](./definition-nodes.md#mutation-rules)). A source `DocumentNode` parsed once at module scope therefore keeps whatever fields earlier tests added to its nodes. When a test's result depends on a fresh schema, call `DocumentNode.fromSource` inside the test's setup.
- **No snapshot tests.** Generated files are artifacts the library uses, not what users are promised. End-to-end tests are behavioural: generate the artifacts from `example/`, attach resolvers, run GraphQL operations, and assert that the API behaves as documented. Unit tests assert specific nodes and fields, not whole printed outputs.
- **Failing tests stay failing.** When a test exposes a real bug, fix the implementation. Do not loosen the assertion or `.skip` the test. If the fix is out of scope, record it in [Known gaps](./known-gaps.md).

## Related

- [Decision 0002 — Behavioural end-to-end tests](../decisions/0002-e2e-local-appsync-executor.md)
- [Conventions](./conventions.md)
- [Plugin API](./plugin-api.md)
- [Known gaps](./known-gaps.md)
