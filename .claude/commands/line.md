---
description: "Add a line to a draft order or quote."
---

# line

Add a line to a draft order or quote.

Run `npm run erp -- line <order> <item> <quantity> <unit price> <line no>`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Unit cost is copied from the item so margin is known at the time of sale.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
