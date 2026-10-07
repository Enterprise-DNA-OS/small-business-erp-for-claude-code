---
description: "List every bill of materials: what goes into each product and the material cost per unit."
---

# bom

List every bill of materials: what goes into each product and the material cost per unit.

Run `npm run erp -- bom`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Total the cost per unit by product when asked what a product costs to make.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
