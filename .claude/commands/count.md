---
description: "Record a stock count. The difference from the record becomes a count movement and the item is marked counted today."
---

# count

Record a stock count. The difference from the record becomes a count movement and the item is marked counted today.

Run `npm run erp -- count <item> <warehouse> <counted quantity> --event=<count sheet ref> [--batch=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Batch-managed items are counted batch by batch.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
