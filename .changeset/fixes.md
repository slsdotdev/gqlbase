---
"@gqlbase/core": patch
"@gqlbase/shared": patch
"@gqlbase/cli": patch
---

Fixes.

- **CLI:** without `--watch`, a failed transform exits with code 1. Before, it exited 0, so CI carried on with stale output.
- **CLI:** the output directory is never read as source. The default `**/*.graphql` used to pick up `generated/schema.graphql`, so the second run failed.
- **Watch mode:** a rebuild produces the same output as the first run (built-in scalars were typed `unknown` after the first). The watcher ignores the output directory and runs only for GraphQL files.
- **CLI:** a config file that fails to load reports the real error, with its cause, instead of "No configuration file found". A missing `--config` path is named. `-c` and `-o` require a value.
- The source can reference generated types such as `StringFilterInput` or `<Model>Connection`. A misspelled type reports "Unknown type".
- `@constraint` is removed from input fields and arguments in the output schema.
- A non-model object type that refers to itself no longer overflows the stack in mutation inputs.
- Source files are joined with a newline, so a file without a trailing newline no longer fuses with the next one.
- Generated TypeScript uses LF line endings, and every generated file imports `../schema.types.js` with its extension.

Read more: [Configuration](https://github.com/slsdotdev/gqlbase/blob/main/docs/guide/configuration.md).
