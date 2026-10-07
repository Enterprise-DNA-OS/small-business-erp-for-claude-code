# CLI reference

Run `npm run erp -- help`. Every command accepts `--json`. Codes match exactly ignoring case, names by any part, IDs by prefix. An ambiguous match lists the candidates and exits 1. Unknown options fail. Dates are YYYY-MM-DD. One business, one country and one currency per database. Order amounts exclude GST; invoice totals are ledger snapshots including GST.

## Start

`npm run migrate` creates an empty database. Then:

```bash
npm run erp -- setup --name="Your business" --country=NZ --currency=NZD --tax-number=123-456-789 --retention-years=7 --min-margin-pct=25 --food-business=true --recall-plan-ref="Recall procedure v1"
```

AU uses `--country=AU --currency=AUD` and your ABN as the tax number. Setup can later change the name, tax number, retention, margin floor, food flag, recall plan reference and backup evidence (`--last-backup=YYYY-MM-DD --backup-ref="..."`), never the country or currency.

## Reads

No arguments: settings, warehouses, customers, suppliers, items, bom, quotes, sales-orders, purchase-orders, production-orders, stock, batches, expiring, mrp, can-make, ship-plan, supplier-chase, quotes-follow-up, approvals, credit-check, receivables, payables, margins, count-due, attention, records, movements, activity, audit, compliance.

With a record: `order <code>` (lines, batches shipped, notes), `item <code>` (stock, batches, what it is made from and goes into), `trace <batch> [--item=]` (one step back, every step forward).

Reviews: `weekly-review` returns attention, ship plan and buy-and-make. `month-end` returns overdue customers, credit, approvals, expiring stock, counts due and late suppliers.

## How the numbers work

- **Stock.** On hand is the sum of movements per item and warehouse. Blocked is stock in held or expired batches. Committed is the open quantity on released sales orders plus what released production runs still need. Incoming is the open quantity on released purchase orders plus what released runs still have to make. Available is on hand minus blocked minus committed.
- **Batches.** Every movement of a batch-managed item carries its batch. Shipping, transfers and production take the earliest expiry first, skip held and expired batches, and split across batches when one is not enough. Naming a batch takes only that batch.
- **Buy and make (`mrp`).** Per item across all warehouses: usable stock, plus open purchases and planned or released runs, minus open sales and the components planned or released runs still need. Below the reorder point, the shortfall is rounded up to the order multiple. Order-by date is the earliest demand date minus the supplier's lead time (or the item's make days). Draft orders and quotes are not demand until released.
- **Can make** compares each planned or released run's remaining component needs with usable stock in its warehouse. Each run is checked on its own; runs sharing a component compete for it.
- **Approvals.** Releasing a sales order checks two things: margin on the order (from the cost frozen on each line) against the margin floor in settings, and the customer's ledger balance plus open and draft orders against their credit limit. Either one fails and the order waits as pending until `approve --by=` or `reject`.
- **Margins** use the cost frozen on each order line when it was entered. They are not an inventory valuation.
- **Trace** follows batch movements: issues into production, the batch each run made, and deliveries to customers, repeated until nothing new is reached.

## Add records

`add <entity> --field=value`. Hyphens for compound names. Relationships accept codes, names or ID prefixes. Required fields marked *.

| Entity | Fields |
|---|---|
| warehouse | code*, name* |
| customer | code*, name*, email, phone, address, tax-id, credit-limit, terms-days, ppsr-ref |
| supplier | code*, name*, email, phone, address, tax-id, terms-days, lead-days |
| item | code*, name*, uom, kind (purchased/made), batch-managed (true/false), shelf-life-days, unit-cost, unit-price, reorder-point, order-multiple, supplier-id, make-days |
| order | code*, kind* (quote/sales/purchase), partner-id*, warehouse-id*, due-on*, valid-until (quotes), reference |
| invoice | code*, kind* (receivable/payable), partner-id*, order-id, issued-on*, due-on*, total*, paid, ledger-ref* |
| record | name*, reference*, prepared-on*, completed-on*, period-end*, retain-until*, source-ref |

New orders and quotes are drafts. `set <entity> <code> --field=value` changes allowed fields and records before and after in the audit table. `set-bom <product> <component> <quantity per unit>` adds or changes a bill of materials line.

## Transactions

```bash
npm run erp -- line SO-1005 TS-300 240 4.20 1            # draft order, item, quantity, unit price, line number
npm run erp -- release SO-1005                           # opens it, or sends it to approval
npm run erp -- approve SO-1004 --by="Mere Tane"
npm run erp -- reject SO-1003 "Wait for INV-2003 to be paid"
npm run erp -- win-quote QT-3001                         # creates SO-3001 as a draft with the same lines
npm run erp -- lose-quote QT-3002 "Went with a cheaper supplier"
npm run erp -- receive PO-2004 1 100 --event=DOCKET-8812 --batch=PT-2501 --supplier-lot=PTP-91002
npm run erp -- ship SO-1001 1 150 --event=DISPATCH-311
npm run erp -- plan-production TS-300 1000 --due-on=2026-10-20 --for-order=SO-1001
npm run erp -- release-production MO-503
npm run erp -- complete-production MO-501 400 --event=RUN-1007 --batch=TS-1007
npm run erp -- close-production MO-503 "Covered from Auckland stock"
npm run erp -- transfer BBQ-300 AKL HAM 40 --event=TR-0042
npm run erp -- count SUGAR HAM 16 --event=COUNT-12 --batch=SG-0820
npm run erp -- adjust-stock LBL-TS HAM -25 "Water damage" --event=ADJ-7
npm run erp -- hold-batch BB-0630 "Cap seal complaint, QA check"
npm run erp -- release-batch BB-0630
npm run erp -- mock-recall PT-2405
npm run erp -- cancel-order PO-2003 "Ordered by phone instead"
npm run erp -- invoice-balance INV-2002 1207.50 "Remittance 5531"
npm run erp -- log SO-1001 "Customer asked for Friday delivery"
```

`--event` is the source document reference. It is unique, so a retry never records the same receipt, dispatch, run, transfer or count twice. Every write runs in one transaction and lands in the audit table.

## Drafts, documents and views

- `draft-quote <quote>`, `draft-order <sales order>`, `draft-chase <purchase order>`, `draft-statement <customer>` and `draft-recall <batch> --reason="..."` write Markdown to `drafts/`. Nothing sends.
- `npm run docs` renders sales confirmations (with the batches shipped), quotes, purchase orders, production sheets, batch trace records and customer statements to `docs-out/` in the brand from `brand.json`. `npm run docs -- batch-trace` renders one type.
- `npm run view` renders the week, production and money views to `views/`.

## Move and back up

- `import sap-business-one <type|bundle> <file|folder> [--date-order=dmy] [--warehouse=] [--apply]`: see docs/replace-sap-business-one.md.
- `export <file>` writes every table to JSON. It refuses to overwrite a file.
