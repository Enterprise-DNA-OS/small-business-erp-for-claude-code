# Why there is no front end

SAP Business One is an ERP: business partners, items, warehouses, quotes, orders, production and the ledger, behind a set of screens. Underneath, the operational half is ordinary records and a handful of jobs repeated every week: ship what is due, make what is short, buy what the runs need, chase what is owed, know where every batch went. Most of the licence and the partner's hours pay for the screens that let people who do not write queries reach those records.

This repo keeps the records and drops the screens. Open the folder in a coding agent, ask in plain words, and it runs the query and explains the answer. A question no report was built for still gets answered.

## What you gain

- **Your own questions.** "Which customers got sauce made from paste lot PT-2405?" or "what do I need to order today so Thursday's run happens?" are one command each.
- **No seats.** Everyone who needs to look can look. Production, the warehouse and the office do not each need a licence.
- **Records you own.** Plain Postgres tables. Back them up, query them from anything, leave whenever you like.
- **Your process, not the package's.** A new approval rule, field or report is a plain request and a tested change, not a partner change request.

## What a screen gives that this does not

- **Scanning on the floor.** Pickers and production staff with barcode scanners need a handheld screen to book batches and counts.
- **Drag and drop scheduling.** A production schedule you rearrange by hand is easier on a board.
- **Phones in the van.** Reps taking orders on the road want a phone form.
- **Live accounting.** The general ledger, bank feeds, GST returns and payroll stay in your accounting system. This holds operational records and copies ledger balances in with a reference.

Enterprise DNA builds whichever of these you need into your own version, on top of the same records.

Installed and run for you: https://enterprisedna.co/omni/instead-of/sap-business-one
