# Sample SAP Business One exports

Fictional records laid out with the field names SAP Business One uses in Data Transfer Workbench templates (CardCode, ItemCode, DocNum, LineNum, OpenQty). The import also accepts the labels on the screens and in Query Manager exports (BP Code, Item No., Open Qty). Some dates are SAP's YYYYMMDD and some are day first, as an NZ or AU user exports them, so import with `--date-order=dmy`.

The set includes a frozen customer, a lead, an inactive item, a closed order, a closed line and a zero-quantity batch, so the dry run shows what is skipped. The test suite imports this folder; use it to try the import before touching your own files.
