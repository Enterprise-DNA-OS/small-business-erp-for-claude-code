---
description: "Close a run that will not be finished, with the reason."
---

# close-production

Close a run that will not be finished, with the reason.

Run `npm run erp -- close-production <run> <reason>`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

A run with nothing made is cancelled; a part-made run is closed.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
