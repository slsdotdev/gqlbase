# Testing

_Audience: contributors and agents._

## Commands

Run from the repo root:

| Command | Purpose |
|---|---|
| `npm test` | Runs `turbo run test`, i.e. Vitest in every package that has a `test` script. |
| `npm run coverage` | Same, with `--coverage`. Reports land in `coverage/<package>`. |
| `npm run lint` | ESLint with auto-fix. It also runs in the Husky pre-commit hook (`.husky/pre-commit`). |
| `npm run build` | Builds every package with `tsc`, in dependency order (`^build`). |
| `npx vitest run packages/<pkg>` | One package. |
| `npx vitest run path/to/file.test.ts` | One file. |
| `npx vitest run -t "name"` | One test, by name. |

**Build before you test.** Tests import sibling packages by their published name (`@gqlbase/core`, `@gqlbase/core/definition`, `@gqlbase/shared/...`). Those resolve through each package's `exports` to `dist/`. The turbo `test` task does not declare `dependsOn: ["^build"]`, so after changing `core` or `shared`, run `npm run build` first. Otherwise the tests run against stale output.

## Layout

- The root `vitest.config.ts` defines one project rooted at `./packages`. Each package has its own `vitest.config.ts`: node environment, globals, and coverage written to `../../coverage/<pkg>`.
- Unit tests sit next to the code they test (`Foo.ts` / `Foo.test.ts`):
  - **core:** every definition node, `TransformerContext`, `GraphQLTransformer`, and `createPluginFactory`.
  - **plugins:** one `<Plugin>.test.ts` per plugin directory. `ScalarsPlugin` and a few others have none.
  - **shared:** string, logger and util helpers.
  - **cli:** the watcher.
- There are **no end-to-end or fixture tests**. Nothing compiles a whole schema through a real preset stack and checks the generated files. `example/` (config in `example/gqlbase.config.js`, schema in `example/src/schema/`) is the only full-pipeline setup, and neither the tests nor CI run it. There are no snapshot tests either.
- CI runs build → lint → test only on pushes to `main` (`.github/workflows/release.yml`). Pull requests run nothing.

## How plugin tests are written

Plugin tests drive the hooks by hand instead of going through `createTransformer`. Use `packages/plugins/src/base/ModelPlugin/ModelPlugin.test.ts` as the reference for which hooks to call. Existing tests create the context at module scope; new tests should use the `let` + `beforeAll` form below.

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

## Conventions

- **No test helper abstractions.** Use the explicit `let` + `beforeAll`/`beforeEach` pattern shown above. Do not build shared factories or builders that hide the plugin setup.
- **Declare every plugin whose directives the schema uses.** A plugin under test whose schema uses another plugin's directive (`@serverOnly`, `@semanticNonNull`) must register that plugin too, or declare the directive in the source. Otherwise the merged document is invalid.
- **Mutations leak between tests unless you re-parse.** `startWork` merges by reference ([Definition nodes → Mutation rules](./definition-nodes.md#mutation-rules)). A source `DocumentNode` parsed once at module scope therefore keeps whatever fields earlier tests added to its nodes. When a test's result depends on a fresh schema, call `DocumentNode.fromSource` inside the test's setup.
- **Failing tests stay failing.** When a test exposes a real bug, fix the implementation. Do not loosen the assertion or `.skip` the test. If the fix is out of scope, record it in [Known gaps](./known-gaps.md).

## Related

- [Conventions](./conventions.md)
- [Plugin API](./plugin-api.md)
- [Known gaps](./known-gaps.md)
