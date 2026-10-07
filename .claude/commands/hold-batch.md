---
description: "Put a batch on hold so it cannot be shipped, transferred or used in production."
---

# hold-batch

Put a batch on hold so it cannot be shipped, transferred or used in production.

Run `npm run erp -- hold-batch <batch> <reason> [--item=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
