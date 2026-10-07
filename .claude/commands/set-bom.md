---
description: "Add a component to a product's bill of materials, or change how much of it goes into one unit."
---

# set-bom

Add a component to a product's bill of materials, or change how much of it goes into one unit.

Run `npm run erp -- set-bom <product> <component> <quantity per unit>`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Show the full bill of materials after the change.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
