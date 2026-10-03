# @gqlbase/cli

## 0.2.0

### Minor Changes

- af89b97: Add transformer options `relay`, `semanticNullability` and `operations`, set under `transform` in the config (next to `plugins`) or at the top level of `createTransformer`, and frozen onto `context.options`. `ModelPlugin` reads `operations` from the context. `RfcFeaturesPlugin`, which declares `@semanticNonNull`, is registered only when `semanticNullability: true`; the default is `false`, so a config whose schema uses the directive must set it.

  Docs: docs/guide/configuration.md, docs/guide/models.md, docs/guide/relay.md, docs/internals/plugin-api.md

### Patch Changes

- c186041: Without `--watch`, a failed transform now exits with code 1. Previously the run went through the watch-mode debouncer, which logged the error and exited 0, so CI and scripts carried on with stale output.

  Docs: docs/guide/configuration.md

- Updated dependencies [5328484]
- Updated dependencies [af89b97]
- Updated dependencies [e656207]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [c186041]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [5328484]
- Updated dependencies [af89b97]
- Updated dependencies [af89b97]
- Updated dependencies [5328484]
- Updated dependencies [512c76e]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [af89b97]
- Updated dependencies [226e3b2]
- Updated dependencies [af89b97]
- Updated dependencies [512c76e]
- Updated dependencies [e656207]
- Updated dependencies [5328484]
- Updated dependencies [c186041]
- Updated dependencies [a34bc19]
- Updated dependencies [af89b97]
- Updated dependencies [af89b97]
- Updated dependencies [c186041]
- Updated dependencies [c186041]
  - @gqlbase/core@0.2.0
  - @gqlbase/shared@0.2.0

## 0.1.11

### Patch Changes

- @gqlbase/core@0.1.11
- @gqlbase/shared@0.1.11

## 0.1.10

### Patch Changes

- @gqlbase/core@0.1.10
- @gqlbase/shared@0.1.10

## 0.1.9

### Patch Changes

- @gqlbase/core@0.1.9
- @gqlbase/shared@0.1.9

## 0.1.8

### Patch Changes

- @gqlbase/core@0.1.8
- @gqlbase/shared@0.1.8

## 0.1.7

### Patch Changes

- @gqlbase/core@0.1.7
- @gqlbase/shared@0.1.7

## 0.1.6

### Patch Changes

- 18da481: Update deps
- Updated dependencies [18da481]
  - @gqlbase/shared@0.1.6
  - @gqlbase/core@0.1.6

## 0.1.5

### Patch Changes

- @gqlbase/core@0.1.5
- @gqlbase/shared@0.1.5

## 0.1.4

### Patch Changes

- @gqlbase/core@0.1.4
- @gqlbase/shared@0.1.4

## 0.1.3

### Patch Changes

- @gqlbase/core@0.1.3
- @gqlbase/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [feca490]
  - @gqlbase/core@0.1.2
  - @gqlbase/shared@0.1.2

## 0.1.1

### Patch Changes

- @gqlbase/core@0.1.1
- @gqlbase/shared@0.1.1

## 0.1.0

### Minor Changes

- 24f07c8: Transformer outputs file contents rather than write to fs.

### Patch Changes

- Updated dependencies [24f07c8]
  - @gqlbase/shared@0.1.0
  - @gqlbase/core@0.1.0

## 0.0.10

### Patch Changes

- Updated dependencies [cbd7391]
  - @gqlbase/shared@0.0.10
  - @gqlbase/core@0.0.10

## 0.0.9

### Patch Changes

- Updated dependencies [ec95c9c]
  - @gqlbase/shared@0.0.9
  - @gqlbase/core@0.0.9

## 0.0.8

### Patch Changes

- @gqlbase/core@0.0.8
- @gqlbase/shared@0.0.8

## 0.0.7

### Patch Changes

- Updated dependencies [309082b]
  - @gqlbase/core@0.0.7
  - @gqlbase/shared@0.0.7

## 0.0.6

### Patch Changes

- dc22a95: Add README files for all packages
- Updated dependencies [dc22a95]
  - @gqlbase/core@0.0.6
  - @gqlbase/shared@0.0.6

## 0.0.5

### Patch Changes

- 41852e8: fix watcher paths ignore
  - @gqlbase/core@0.0.5
  - @gqlbase/shared@0.0.5

## 0.0.4

### Patch Changes

- @gqlbase/core@0.0.4
- @gqlbase/shared@0.0.4

## 0.0.2

### Patch Changes

- 52f4e5d: cli package
- 68109c1: feat(plugins): added ModelPlugin
- Updated dependencies [52f4e5d]
- Updated dependencies [fbc977e]
- Updated dependencies [d09d42e]
- Updated dependencies [710da2f]
- Updated dependencies [68109c1]
- Updated dependencies [4cbe6d8]
  - @gqlbase/core@0.0.3
  - @gqlbase/shared@0.0.2
