---
description: "List every open sales line by due date with usable stock in its warehouse and any shortage."
---

# ship-plan

List every open sales line by due date with usable stock in its warehouse and any shortage.

Run `npm run erp -- ship-plan`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Usable stock leaves out held and expired batches.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
