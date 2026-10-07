---
description: "Record finished goods from a released run: components are issued first expiry first out and the output gets its batch number."
---

# complete-production

Record finished goods from a released run: components are issued first expiry first out and the output gets its batch number.

Run `npm run erp -- complete-production <run> <quantity> --event=<run sheet ref> [--batch=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Show the lots used. A part quantity leaves the run open.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
