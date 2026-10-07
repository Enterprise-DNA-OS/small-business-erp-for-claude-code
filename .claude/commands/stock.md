---
description: "Show on hand, blocked (held or expired), committed, available and incoming for every item in every warehouse."
---

# stock

Show on hand, blocked (held or expired), committed, available and incoming for every item in every warehouse.

Run `npm run erp -- stock`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Negative available means orders or released runs need more than the shelf holds.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
