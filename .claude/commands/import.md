---
description: "Bring records across from SAP Business One CSV exports."
---

# import

Bring records across from SAP Business One CSV exports.

Run `npm run erp -- import sap-business-one bundle <folder> --date-order=dmy [--warehouse=] [--apply]`. Add `--json` when you need to analyse the result further. Names match case-insensitively and IDs by prefix; if a name is ambiguous, list the candidates and ask.

Read docs/replace-sap-business-one.md. Always do a dry run first and show the counts. Apply only after the operator says yes.

Never send, pay or delete anything. Arguments in full: docs/cli.md.
