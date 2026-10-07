---
description: "Work out what to buy and what to make: projected stock after open orders and planned runs, against the reorder point, rounded up to the order multiple, with the date to order by."
---

# mrp

Work out what to buy and what to make: projected stock after open orders and planned runs, against the reorder point, rounded up to the order multiple, with the date to order by.

Run `npm run erp -- mrp`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Lead with anything marked late. Offer to raise the purchase orders as drafts with /add and /line, or the runs with /plan-production. Never release them without a yes.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
