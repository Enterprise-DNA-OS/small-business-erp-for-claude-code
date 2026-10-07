---
description: "Record goods dispatched against a sales order line. Batches are picked first expiry first out, skipping held and expired stock, unless one is named."
---

# ship

Record goods dispatched against a sales order line. Batches are picked first expiry first out, skipping held and expired stock, unless one is named.

Run `npm run erp -- ship <sales order> <line no> <quantity> --event=<dispatch ref> [--batch=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Show which batches went.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
