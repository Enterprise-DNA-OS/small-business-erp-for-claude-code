---
description: "Move stock from one warehouse to another, batch by batch."
---

# transfer

Move stock from one warehouse to another, batch by batch.

Run `npm run erp -- transfer <item> <from> <to> <quantity> --event=<ref> [--batch=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
