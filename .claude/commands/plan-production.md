---
description: "Plan a production run of a made item."
---

# plan-production

Plan a production run of a made item.

Run `npm run erp -- plan-production <item> <quantity> --due-on=<date> [--warehouse=] [--code=] [--for-order=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Run /can-make for it afterwards.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
