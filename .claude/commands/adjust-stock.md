---
description: "Record a stock difference with its reason (damage, write-off, sample)."
---

# adjust-stock

Record a stock difference with its reason (damage, write-off, sample).

Run `npm run erp -- adjust-stock <item> <warehouse> <quantity +/-> <reason> --event=<ref> [--batch=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
