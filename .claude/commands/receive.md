---
description: "Record goods received against a purchase order line. Batch-managed items need the batch, and the supplier lot so a supplier recall can be matched."
---

# receive

Record goods received against a purchase order line. Batch-managed items need the batch, and the supplier lot so a supplier recall can be matched.

Run `npm run erp -- receive <purchase order> <line no> <quantity> --event=<delivery docket> [--batch=] [--supplier-lot=] [--expires-on=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Expiry defaults to today plus the item's shelf life. The event reference stops the same docket being counted twice.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
