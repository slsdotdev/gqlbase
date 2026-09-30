---
"@gqlbase/shared": patch
---

`definitionFromFiles` joins source files with a newline, so a file that ends in a name token without a trailing newline no longer fuses with the first token of the next file.

Docs: docs/guide/configuration.md, docs/internals/known-gaps.md
