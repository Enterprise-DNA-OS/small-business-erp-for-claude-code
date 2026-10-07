---
description: "Mark a quote won and turn it into a draft sales order with the same lines."
---

# win-quote

Mark a quote won and turn it into a draft sales order with the same lines.

Run `npm run erp -- win-quote <quote> [--code=] [--due-on=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Then release the new sales order.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
