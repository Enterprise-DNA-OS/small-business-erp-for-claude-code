---
description: "Check each planned or released production run against the components on the shelf and show what is short."
---

# can-make

Check each planned or released production run against the components on the shelf and show what is short.

Run `npm run erp -- can-make`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Each run is checked on its own; two runs can both look fine while sharing the same stock. Say so when they share a component.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
