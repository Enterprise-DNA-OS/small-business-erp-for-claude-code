---
description: "Set the business name, country, currency, GST number or ABN, record retention, margin floor, food business flag, recall plan reference and backup evidence, once per database."
---

# setup

Set the business name, country, currency, GST number or ABN, record retention, margin floor, food business flag, recall plan reference and backup evidence, once per database.

Run `npm run erp -- setup --name=<name> [--country=NZ|AU] [--currency=NZD|AUD] [--tax-number=] [--retention-years=] [--min-margin-pct=] [--food-business=true|false] [--recall-plan-ref=] [--last-backup=] [--backup-ref=]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Country and currency are fixed once set.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
