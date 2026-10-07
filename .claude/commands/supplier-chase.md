---
description: "List purchase orders due within a week or already late, with days late."
---

# supplier-chase

List purchase orders due within a week or already late, with days late.

Run `npm run erp -- supplier-chase`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Offer /draft-chase for each late one.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
