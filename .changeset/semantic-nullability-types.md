---
"@gqlbase/plugins": patch
---

Fix level-aware semantic nullability in type generation. `isSemanticNullable` now unwraps to the correct depth level, and `ModelTypesGeneratorPlugin` wraps inner list types with `Maybe` when they are nullable at their respective level.
