# @gqlbase/plugins

## 0.0.10

### Patch Changes

- cbd7391: Update dependencies
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

- 2f3cc44: Added `appSyncPreset` with `AppSynUtilsPlugin` for aws appsync support
- 2f3cc44: Added AppSyncSchemaGeneratorPlugin
  - @gqlbase/core@0.0.8
  - @gqlbase/shared@0.0.8

## 0.0.7

### Patch Changes

- 309082b: Add test coverage for `ConnectionPlugin` and detect conflicting pagination connection types from `RelationsPlugin`.
- 309082b: Add comprehensive test coverage for `NodeInterfacePlugin` and refactor plugin to use `TransformerPluginBase`.
- 309082b: Fix level-aware semantic nullability in type generation. `isSemanticNullable` now unwraps to the correct depth level, and `ModelTypesGeneratorPlugin` wraps inner list types with `Maybe` when they are nullable at their respective level.
- 309082b: Added InterfaceUtilsPlugin
- 309082b: Added RfcFeaturesPlugin
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

- acf3f62: Added ScalarsPlugin
- a53c785: Added ModelTypesGeneratorPlugin
  - @gqlbase/core@0.0.5
  - @gqlbase/shared@0.0.5

## 0.0.4

### Patch Changes

- deb9567: feat: base preset plugins
  - @gqlbase/core@0.0.4
  - @gqlbase/shared@0.0.4

## 0.0.2

### Patch Changes

- 68109c1: feat(plugins): added ModelPlugin
- Updated dependencies [52f4e5d]
- Updated dependencies [fbc977e]
- Updated dependencies [d09d42e]
- Updated dependencies [710da2f]
- Updated dependencies [68109c1]
- Updated dependencies [4cbe6d8]
  - @gqlbase/core@0.0.3
  - @gqlbase/shared@0.0.2
