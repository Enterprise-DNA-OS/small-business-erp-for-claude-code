---
description: "Add a warehouse, customer, supplier, item, order or quote, invoice or record."
---

# add

Add a warehouse, customer, supplier, item, order or quote, invoice or record.

Run `npm run erp -- add <warehouse|customer|supplier|item|order|invoice|record> --field=value ...`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Orders take --kind=quote|sales|purchase and --partner-id. Show the record back after adding.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
