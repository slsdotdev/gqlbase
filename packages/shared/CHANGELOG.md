# @gqlbase/shared

## 0.2.1

## 0.2.0

### Patch Changes

- a28b646: Fixes.

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

## 0.1.11

## 0.1.10

## 0.1.9

## 0.1.8

## 0.1.7

## 0.1.6

### Patch Changes

- 18da481: Update deps

## 0.1.5

## 0.1.4

## 0.1.3

## 0.1.2

## 0.1.1

## 0.1.0

### Minor Changes

- 24f07c8: Transformer outputs file contents rather than write to fs.

## 0.0.10

### Patch Changes

- cbd7391: Update dependencies

## 0.0.9

### Patch Changes

- ec95c9c: Fix pascal case formating for leading uppercased segments

## 0.0.8

## 0.0.7

## 0.0.6

### Patch Changes

- dc22a95: Add README files for all packages

## 0.0.5

## 0.0.4

## 0.0.2

### Patch Changes

- fbc977e: Added shared package
- 68109c1: feat(plugins): added ModelPlugin
