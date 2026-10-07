# Moving off SAP Business One

This guide takes the operational records out of SAP Business One and loads them here: business partners, items, bills of materials, stock and batches, and open orders. Your accounting ledger stays where it is. Plan a day for a first pass, and keep the original files as your record of what was moved.

## 1. Export from SAP Business One

Two ways out, both ending as CSV files in one folder:

- **Query Manager** (Tools > Queries > Query Generator or Query Manager). Run the queries below, then use the Export to Excel button on the result and save each one as CSV (UTF-8). This is the most reliable route because you control the columns.
- **Export to Excel from a screen or report.** Any grid with the Excel button exports what is shown. Rename the headings to match the table below, or keep SAP's screen labels where the import already reads them (BP Code, BP Name, Item No., Item Description, Open Qty).

The import reads SAP's own field names, as used in Data Transfer Workbench templates, so the queries alias the table columns to those names. The queries are written for the SQL Server and HANA versions; your partner can adjust them if your database differs.

| File | Columns the import reads | Query |
|---|---|---|
| business-partners.csv | CardCode, CardName, CardType, Phone1, EmailAddress, Address, City, FederalTaxID, CreditLimit, Frozen | `SELECT CardCode, CardName, CardType, Phone1, E_Mail AS "EmailAddress", Address, City, LicTradNum AS "FederalTaxID", CreditLine AS "CreditLimit", frozenFor AS "Frozen" FROM OCRD` |
| items.csv | ItemCode, ItemName, InventoryUOM, ProcurementMethod, ManageBatchNumbers, AvgStdPrice, MinInventory, OrderMultiple, Mainsupplier, LeadTime, Valid, and optionally Price and Shelf Life (Days) | `SELECT ItemCode, ItemName, InvntryUom AS "InventoryUOM", PrcrmntMtd AS "ProcurementMethod", ManBtchNum AS "ManageBatchNumbers", AvgPrice AS "AvgStdPrice", MinLevel AS "MinInventory", OrdrMulti AS "OrderMultiple", CardCode AS "Mainsupplier", LeadTime, validFor AS "Valid" FROM OITM` |
| bom.csv | TreeCode, Parent Quantity, ItemCode, Quantity | `SELECT T0.Father AS "TreeCode", T1.Qauntity AS "Parent Quantity", T0.Code AS "ItemCode", T0.Quantity FROM ITT1 T0 JOIN OITT T1 ON T1.Code = T0.Father` (Qauntity is SAP's own spelling) |
| stock.csv | ItemCode, WhsCode, OnHand | `SELECT T0.ItemCode, T0.WhsCode, T0.OnHand FROM OITW T0 JOIN OITM T1 ON T1.ItemCode = T0.ItemCode WHERE T0.OnHand <> 0 AND T1.ManBtchNum = 'N'` |
| batches.csv | ItemCode, BatchNumber, WhsCode, Quantity, MnfDate, ExpDate, MnfSerial | `SELECT T0.ItemCode, T1.DistNumber AS "BatchNumber", T0.WhsCode, T0.Quantity, T1.MnfDate, T1.ExpDate, T1.MnfSerial FROM OBTQ T0 JOIN OBTN T1 ON T1.ItemCode = T0.ItemCode AND T1.SysNumber = T0.SysNumber WHERE T0.Quantity <> 0` |
| sales-orders.csv | DocNum, CardCode, DocDueDate, NumAtCard, DocStatus, WhsCode | `SELECT DocNum, CardCode, DocDueDate, NumAtCard, DocStatus FROM ORDR WHERE DocStatus = 'O'` (add WhsCode from the lines, or pass `--warehouse=`) |
| sales-lines.csv | DocNum, LineNum, ItemCode, OpenQty, Price, UoMCode, WarehouseCode, LineStatus | `SELECT T1.DocNum, T0.LineNum, T0.ItemCode, T0.OpenQty, T0.Price, T0.UomCode AS "UoMCode", T0.WhsCode AS "WarehouseCode", T0.LineStatus FROM RDR1 T0 JOIN ORDR T1 ON T1.DocEntry = T0.DocEntry WHERE T1.DocStatus = 'O'` |
| purchase-orders.csv | as sales-orders | the same query on OPOR |
| purchase-lines.csv | as sales-lines | the same query on POR1 and OPOR |

Column names match without case. A heading your system renamed needs mapping: rename the column in Excel, or ask your coding agent to add the alternative name in `scripts/lib/import.mjs`. Item shelf life is not a standard SAP field; if you keep it in a user-defined field, export it as `Shelf Life (Days)`.

Warehouses are created first, by hand, with the same codes SAP Business One uses:

```bash
npm run erp -- add warehouse --code=01 --name="Main warehouse"
```

## 2. Do a test run

```bash
npm run erp -- import sap-business-one bundle exports --date-order=dmy
```

Without `--apply` nothing is kept: the whole batch runs inside a transaction and is rolled back, and you see counts of inserted, existing and skipped rows per file. Dates can be SAP's YYYYMMDD, ISO, or day first as NZ and AU users export them, hence `--date-order=dmy`. `--warehouse=` fills in a missing warehouse column.

## 3. Apply

```bash
npm run erp -- import sap-business-one bundle exports --date-order=dmy --apply
```

One transaction: if any row fails, nothing from any file is kept and the error names the file and row. Running the same files again inserts nothing.

## What maps

- Customers and suppliers, with the full source row kept in `source_data`. Leads are skipped.
- Items: inventory unit, make or buy, batch managed, cost, minimum level as the reorder point, order multiple, preferred supplier and lead time.
- Bills of materials, divided down to the quantity per single unit of the product.
- Stock on hand per warehouse, and batch stock with its manufacturing date, expiry and the supplier's lot (MnfSerial), as opening movements.
- Open sales and purchase orders as drafts, with the open quantity on each line. SAP numbers lines from 0; they arrive here from 1. Release each order after checking it.

## What does not come across

- **Frozen, inactive and closed records** are skipped and counted.
- **History already fulfilled.** Delivered and received quantities stay in your SAP Business One archive; only open quantities load, so nothing ships twice. Batch history before the switch (which customer got which lot) stays in SAP: keep its batch reports for the retention period.
- **Production orders.** Finish or close the runs in SAP before the switch, then plan new ones here.
- **Approval procedures.** One margin floor and the credit limit replace them. Add any other rule with /customise.
- **Price lists and special prices.** The item's price and the price on each open line come across; per-customer price lists are a /customise job.
- **The ledger.** Journals, bank, GST returns and payroll stay in your accounting system. Copy open customer and supplier balances in with `add invoice` and a ledger reference.
- **Units of measure.** A line in a unit other than the item's inventory unit is refused. Convert it first.

## Run both side by side

Keep SAP Business One running for one month end. Compare stock by batch, open orders and what each says to buy and make. When they agree, stop entering in SAP Business One and keep its exports in your archive for the retention period.

Enterprise DNA does this mapping, the reconciliation and the parallel month for businesses that want it done for them: https://enterprisedna.co/omni/instead-of/sap-business-one
