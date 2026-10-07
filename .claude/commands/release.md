---
description: "Release a draft order or quote. A sales order below the margin floor or over the customer's credit limit goes to approval instead."
---

# release

Release a draft order or quote. A sales order below the margin floor or over the customer's credit limit goes to approval instead.

Run `npm run erp -- release <order>`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

If it went to approval, say why in one line and who can approve it.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
