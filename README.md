# Small Business ERP for Claude Code

Quotes, orders, stock, bills of materials, production runs and batch traceability in a database you own. A free, open-source operations base for NZ and AU manufacturers and distributors of 10 to 50 people: food and drink makers, chemical and cleaning product blenders, packers, wholesalers who assemble kits. MIT licensed. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free. Clone, run the demo, import your SAP Business One exports. | Your fields, approval rules, documents, SAP Business One data brought across, a web front end or a different stack. | Installed, connected and operated through Omni by Enterprise DNA. Setup fee, then a retainer. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=sap-business-one&utm_medium=customise) | [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=sap-business-one&utm_medium=managed) |

## What you pay for now

SAP does not publish a price for SAP Business One in Australia or New Zealand. It is sold through SAP partners: a licence for each named user by type (Starter Package, Limited or Professional), either as a monthly subscription or bought outright with an annual maintenance fee, plus a partner implementation project and support. One Australian partner lists subscriptions at A$138 a user a month for the Starter Package and A$213 for Professional, and indicative implementations of A$15,000 to A$45,000 ([Cloud Factory, read 7 October 2026](https://www.cloudfactory.co/solutions/erp/sap-business-one/pricing)). Ten Professional users at that rate is A$25,560 a year before the implementation, hosting and support. Ask your partner for your user count, licence types and last implementation invoice, and you have your own figure.

## The weekly routine

Monday: what is late, what can ship, and what to buy or make today so this week's runs happen. Midweek: chase late suppliers, release runs that have their components, approve the orders waiting on margin or credit. Every day: receive with the supplier's lot number, ship first expiry first out, keep held batches off the truck. When something goes wrong: trace the batch back to the supplier lot and forward to every customer, in one command.

The base records customers and suppliers, items, bills of materials, quotes, sales and purchase orders with partial receipts and dispatches, approvals, production runs that issue components and create batches, transfers, counts, holds, ledger balance snapshots, document evidence and change history. The general ledger, GST returns and payroll stay in your accounting system.

The demo business, Rimu Foods Demo, is fictional: a Hamilton maker of tomato and barbecue sauces with a factory store and stock at an Auckland third-party warehouse. It has a late wholesale order short of sauce, a production run short of bottles, a low-margin cafe order and an over-limit foodservice order waiting for approval, a quote about to lapse, a paste lot that expires in 12 days, a batch on hold for a cap seal complaint, and three ingredients it should have ordered already.

## Quick start

Node 20 or later on Windows, macOS or Linux. No database server needed for the demo:

```bash
git clone https://github.com/Enterprise-DNA-OS/small-business-erp-for-claude-code.git
cd small-business-erp-for-claude-code
npm install
npm run demo
npm test
npm run view
npm run docs
```

Open the folder in your coding agent and ask "What do I need to order today?" or run `/weekly-review`.

For real records, use a fresh `DATA_DIR` (or set `DATABASE_URL` to your own Postgres or Supabase), run `npm run migrate`, then `setup` and `import`. Never seed a real database. The embedded PGlite database serves one process at a time; a shared team setup needs Postgres with scoped access, TLS and tested backups.

## Commands

68 CLI commands, each with human tables or `--json`, and 70 slash commands: one per CLI command plus /customise and /new-view. [Arguments and how each number is worked out](docs/cli.md).

| Command | What it does |
|---|---|
| /settings | Show the business name, country, currency, GST number, record retention, margin floor, recall plan and last backup. |
| /warehouses | List warehouses and how many items each holds. |
| /customers | List customers with contact details, tax ID, credit limit, payment terms and PPSR registration. |
| /suppliers | List suppliers with lead times and payment terms. |
| /items | List items: unit, made or bought, batch managed, shelf life, cost, price, reorder point, order multiple, supplier and last count. |
| /bom | List every bill of materials: what goes into each product and the material cost per unit. |
| /quotes | List quotes with status, valid-until date, value, margin and last activity. |
| /sales-orders | List sales orders by due date with warehouse, approval state, open value and margin. |
| /purchase-orders | List purchase orders by due date with open value. |
| /production-orders | List production orders: released first, then planned, with quantity left to make and the sales order each one is for. |
| /stock | Show on hand, blocked (held or expired), committed, available and incoming for every item in every warehouse. |
| /batches | List every batch with stock: warehouse, made and expiry dates, days left, hold state, supplier lot or production order. |
| /expiring | List batches with stock that expire within 30 days, or already have. |
| /mrp | Work out what to buy and what to make: projected stock after open orders and planned runs, against the reorder point, rounded up to the order multiple, with the date to order by. |
| /can-make | Check each planned or released production run against the components on the shelf and show what is short. |
| /ship-plan | List every open sales line by due date with usable stock in its warehouse and any shortage. |
| /supplier-chase | List purchase orders due within a week or already late, with days late. |
| /quotes-follow-up | List open quotes that have gone quiet for five days or expire within a week. |
| /approvals | List sales orders waiting for approval, with the reason: margin below the floor or over the credit limit. |
| /credit-check | List customers whose ledger balance plus open and draft orders is over their credit limit. |
| /receivables | List what customers owe from the ledger, aged current, 1-30, 31-60 and 60+. |
| /payables | List what we owe suppliers from the ledger, with days overdue. |
| /margins | Show shipped value, shipped margin and open value by customer. |
| /count-due | List items with stock that have not been counted in 90 days, or ever. |
| /attention | List what has gone wrong or quiet: late or quiet orders, orders waiting for approval, quotes about to lapse, runs past due or short, batches on hold or near expiry, overdue invoices. |
| /records | List the document evidence register with retention dates and archive references. |
| /movements | Show every stock movement: receipts, deliveries, issues to production, output, transfers, counts and adjustments, with the batch. |
| /activity | Show the follow-up notes logged against orders and production runs. |
| /audit | Show the change history of every write made through the CLI. |
| /help | List every CLI command and open the guide. |
| /compliance | Check the records against the NZ and AU rules in docs/compliance.md: record retention, GST invoice details, PPSR for credit customers, food recall plans and practice recalls, supplier lots, and house rules. |
| /weekly-review | Write the Monday plan from three live reads: attention, ship plan and buy-and-make. |
| /month-end | Run the month-end checklist: overdue customers, credit, approvals, expiring stock, counts due and late suppliers. |
| /order | Show one order or quote with its lines, the batches shipped and its follow-up notes. |
| /item | Show one item: stock by warehouse, batches, what it is made from and what it goes into. |
| /trace | Trace a batch one step back to the supplier lot and forward through production to every customer who received it, and what is still on the shelf. |
| /setup | Set the business name, country, currency, GST number or ABN, record retention, margin floor, food business flag, recall plan reference and backup evidence, once per database. |
| /add | Add a warehouse, customer, supplier, item, order or quote, invoice or record. |
| /set | Change allowed fields on an existing record. |
| /line | Add a line to a draft order or quote. |
| /set-bom | Add a component to a product's bill of materials, or change how much of it goes into one unit. |
| /release | Release a draft order or quote. A sales order below the margin floor or over the customer's credit limit goes to approval instead. |
| /approve | Approve a sales order waiting for approval and release it. |
| /reject | Reject a sales order waiting for approval, with the reason. |
| /win-quote | Mark a quote won and turn it into a draft sales order with the same lines. |
| /lose-quote | Mark a quote lost with the reason. |
| /cancel-order | Cancel a sales or purchase order that has not been received or shipped against. |
| /receive | Record goods received against a purchase order line. Batch-managed items need the batch, and the supplier lot so a supplier recall can be matched. |
| /ship | Record goods dispatched against a sales order line. Batches are picked first expiry first out, skipping held and expired stock, unless one is named. |
| /plan-production | Plan a production run of a made item. |
| /release-production | Release a planned run to the floor, so its components count as committed. |
| /complete-production | Record finished goods from a released run: components are issued first expiry first out and the output gets its batch number. |
| /close-production | Close a run that will not be finished, with the reason. |
| /transfer | Move stock from one warehouse to another, batch by batch. |
| /adjust-stock | Record a stock difference with its reason (damage, write-off, sample). |
| /count | Record a stock count. The difference from the record becomes a count movement and the item is marked counted today. |
| /hold-batch | Put a batch on hold so it cannot be shipped, transferred or used in production. |
| /release-batch | Take a batch off hold. |
| /mock-recall | Run a practice recall on a batch: trace it, count customers and stock, and record the date. |
| /invoice-balance | Copy an invoice balance verified in the accounting ledger. |
| /log | Record a factual follow-up note on an order, quote or production run. |
| /draft-quote | Draft a quote letter to the customer into drafts/. |
| /draft-order | Draft a sales order confirmation to the customer into drafts/. |
| /draft-chase | Draft a supplier follow-up for a late or due purchase order into drafts/. |
| /draft-statement | Draft a statement letter to a customer listing their outstanding invoices into drafts/. |
| /draft-recall | Draft a recall notice to every customer who received a batch or anything made from it, one file per customer, into drafts/. |
| /import | Bring records across from SAP Business One CSV exports. |
| /export | Write a complete snapshot of every table to a JSON file. |
| /customise | Add a field, rename a status, change a rule or add a report in plain language, with a migration and a test. |
| /new-view | Add a read-only HTML view from a plain-language description. |

## Ten questions the standard screens do not answer

Each one runs on the demo today and is a query you can change.

1. Which customers received anything made from paste lot PT-2405, and how much is still on our shelf? `npm run erp -- trace PT-2405`
2. What do I need to order today so this week's runs happen, and what is already late? `npm run erp -- mrp`
3. Which production runs are short of a component, and by how much? `npm run erp -- can-make`
4. Which late orders are short of usable stock once held and expired batches are left out? `npm run erp -- ship-plan`
5. Which orders are waiting for approval, and is it margin or credit? `npm run erp -- approvals`
6. Which customers are over their credit limit once draft orders are counted? `npm run erp -- credit-check`
7. Which quotes have gone quiet or lapse this week? `npm run erp -- quotes-follow-up`
8. Which batches expire in the next 30 days, and where are they? `npm run erp -- expiring`
9. Which items have not been counted in 90 days? `npm run erp -- count-due`
10. Which credit customers have no PPSR registration, and is our recall plan in date? `npm run erp -- compliance`

## Your first hour: ten things to ask for

1. Put our name, logo and colours on the sales confirmation.
2. Set up our warehouses with the codes we use in SAP Business One now.
3. Do a test run of the import with our business partner and item exports.
4. Load our batch stock with expiry dates.
5. Tell me what to buy and make this week.
6. Show me which runs are short of components.
7. Set our margin floor to 30% and show me what would need approval.
8. Run a practice recall on last month's busiest batch.
9. Add a "pallet configuration" field to items.
10. Make a Monday view for the production manager.

## Documents and views

Edit `brand.json` once. `npm run docs` writes sales confirmations with the batches shipped, quotes, purchase orders, production sheets, batch trace records and customer statements to `docs-out/`, one HTML file per record, ready to print to PDF. `npm run view` writes the week, production and money views to `views/`. Nothing sends.

## Bring your history

[The SAP Business One guide](docs/replace-sap-business-one.md) gives a Query Manager query for every file, the columns read, the test run, what maps and what stays behind. `npm run erp -- import sap-business-one bundle exports --date-order=dmy --apply` loads every file in one transaction; a failed row keeps nothing. Open quantities only, so nothing ships twice.

## Controls and scope

Receipts and dispatches cannot exceed the open line. Stock cannot go negative in any warehouse or batch. Held and expired batches cannot ship, move or go into production. Batch-managed items cannot move without a batch. Unique event references stop a retry from doubling a receipt, dispatch, run or count. A sales order below the margin floor or over the credit limit cannot open without a named approver. Every write is one transaction with an audit row.

[Record checks](docs/compliance.md) cover NZ and AU record retention, GST invoice details, PPSR registration for credit customers, food recall plans, practice recalls and supplier lot numbers, and house rules, each with its source. They check recorded evidence, not legal compliance. [Why no front end](docs/why-no-front-end.md) says honestly what a screen gives that this does not.

This is the operations side of an ERP, not the general ledger, bank feeds, GST filing, payroll, capacity scheduling or landed cost, and it does not claim parity with SAP Business One.

## Verification

`npm test` builds a temporary database, migrates and seeds it, runs all 68 CLI commands, and checks stock, batch picking, production issues, buy-and-make, approvals, the recall trace, duplicate events, rollback, ambiguous names, the import, drafts and branded HTML. CI runs it on Windows, Linux and a real Postgres.

## Licence

MIT. Built by Enterprise DNA. Not affiliated with SAP or Anthropic. SAP and SAP Business One are trademarks of SAP SE. [Omni by Enterprise DNA](https://enterprisedna.co/omni/instead-of/sap-business-one?utm_source=github&utm_campaign=sap-business-one&utm_medium=readme) installs, customises and runs your version. [Book 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=sap-business-one&utm_medium=readme).
