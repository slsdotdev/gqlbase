---
"@gqlbase/cli": patch
---

Without `--watch`, a failed transform now exits with code 1. Previously the run went through the watch-mode debouncer, which logged the error and exited 0, so CI and scripts carried on with stale output.

Docs: docs/guide/configuration.md
