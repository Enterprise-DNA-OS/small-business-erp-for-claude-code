---
description: "List batches with stock that expire within 30 days, or already have."
---

# expiring

List batches with stock that expire within 30 days, or already have.

Run `npm run erp -- expiring`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Suggest which orders or runs could use each batch first. Expired stock should be put on hold with /hold-batch.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
