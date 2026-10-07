# Small Business ERP for Claude Code

## Business context

Business: [your business]. Operator: [name and role]. One database holds one business, one country and one currency, across as many warehouses as you run. What matters: orders shipped on time, runs that have their components, stock bought before it is late, every batch traceable one step back and one step forward. Rimu Foods Demo is fictional.

## Routes

Read the matching .claude/commands recipe. Arguments and calculations: docs/cli.md.

| Job | Route |
|---|---|
| Start the day | /attention, /ship-plan, /approvals |
| Monday plan | /weekly-review |
| What to buy and make | /mrp, /can-make, /plan-production, /supplier-chase, /draft-chase |
| Production | /production-orders, /release-production, /complete-production, /close-production, /bom, /set-bom |
| Quotes | /quotes, /quotes-follow-up, /draft-quote, /win-quote, /lose-quote |
| Selling and dispatch | /sales-orders, /order, /release, /approve, /reject, /ship, /credit-check, /draft-order |
| Buying | /purchase-orders, /add, /line, /release, /receive |
| Stock and batches | /stock, /batches, /expiring, /item, /transfer, /count, /count-due, /adjust-stock, /hold-batch, /release-batch, /movements |
| Recall or complaint | /trace, /hold-batch, /draft-recall, /mock-recall |
| Money | /receivables, /payables, /draft-statement, /invoice-balance, /margins |
| Month end | /month-end |
| Record checks | /compliance and docs/compliance.md |
| Reference data | /settings, /warehouses, /customers, /suppliers, /items, /records, /activity, /audit |
| Change records | /add, /set, /cancel-order, /log |
| Paperwork and views | npm run docs, npm run view, /new-view |
| Move or tailor | /setup, /import, /export, /customise |

## Rules

Read fresh data before answering. Never invent receipts, dispatches, counts, batch numbers, lots, approvals or ledger balances. List ambiguous candidates and ask. Nothing sends, pays, files GST, registers on the PPSR, notifies a regulator or deletes. Drafts stay in drafts/. The ledger, bank, GST and payroll stay in the accounting system.

Approvals need the approver's name from the operator in this session. In a recall, run /trace first, put stock still held on hold, then draft the notices; the written recall plan and the call to the regulator are a person's job. Read docs/compliance.md before changing a record check; a clean check is not legal certification.

Use the CLI for writes. New questions are parameterised SQL in scripts/lib/domain.mjs. Schema changes are a new numbered migration; never edit one already applied. Export a backup and run npm test before real changes. Never seed a real database.

## Files

Schema: supabase/migrations. CLI: scripts/erp.mjs. Reports, batch picking, trace and checks: scripts/lib/domain.mjs. Import: scripts/lib/import.mjs. Brand: brand.json. Documents: documents.json. Views: views.json. Moving off SAP Business One: docs/replace-sap-business-one.md. Other agents read AGENTS.md.

Omni by Enterprise DNA installs, customises and runs this for you: https://enterprisedna.co/omni/instead-of/sap-business-one
