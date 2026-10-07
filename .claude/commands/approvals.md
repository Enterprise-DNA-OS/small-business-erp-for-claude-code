---
description: "List sales orders waiting for approval, with the reason: margin below the floor or over the credit limit."
---

# approvals

List sales orders waiting for approval, with the reason: margin below the floor or over the credit limit.

Run `npm run erp -- approvals`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Show the numbers behind each reason. Approve only on the operator's yes, with their name.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
