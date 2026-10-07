---
description: "Draft a recall notice to every customer who received a batch or anything made from it, one file per customer, into drafts/."
---

# draft-recall

Draft a recall notice to every customer who received a batch or anything made from it, one file per customer, into drafts/.

Run `npm run erp -- draft-recall <batch> --reason="<what is wrong>" [--item=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Nothing sends. Run /trace first and follow the written recall plan, including telling the regulator.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
