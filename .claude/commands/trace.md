---
description: "Trace a batch one step back to the supplier lot and forward through production to every customer who received it, and what is still on the shelf."
---

# trace

Trace a batch one step back to the supplier lot and forward through production to every customer who received it, and what is still on the shelf.

Run `npm run erp -- trace <batch> [--item=<item>]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

This is the first command in a recall or a supplier complaint. Present it as: where it came from, what it went into, who has it, what we still hold. Then offer /hold-batch for stock still held and /draft-recall for customers.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
