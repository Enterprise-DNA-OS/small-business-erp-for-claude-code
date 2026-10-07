---
description: "Check the records against the NZ and AU rules in docs/compliance.md: record retention, GST invoice details, PPSR for credit customers, food recall plans and practice recalls, supplier lots, and house rules."
---

# compliance

Check the records against the NZ and AU rules in docs/compliance.md: record retention, GST invoice details, PPSR for credit customers, food recall plans and practice recalls, supplier lots, and house rules.

Run `npm run erp -- compliance`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Report as a table: rule, record, finding, source. For each one, propose the fix as a command the operator can approve. A clean result is not legal certification. If a rule looks out of date, say so and stop.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
