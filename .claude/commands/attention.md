---
description: "List what has gone wrong or quiet: late or quiet orders, orders waiting for approval, quotes about to lapse, runs past due or short, batches on hold or near expiry, overdue invoices."
---

# attention

List what has gone wrong or quiet: late or quiet orders, orders waiting for approval, quotes about to lapse, runs past due or short, batches on hold or near expiry, overdue invoices.

Run `npm run erp -- attention`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Group by record type. Suggest one next step for each, and do not invent reasons the data does not show.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
