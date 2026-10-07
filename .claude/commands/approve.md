---
description: "Approve a sales order waiting for approval and release it."
---

# approve

Approve a sales order waiting for approval and release it.

Run `npm run erp -- approve <order> --by=<name>`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Only on the operator's explicit yes. Record the approver's name as they give it.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
