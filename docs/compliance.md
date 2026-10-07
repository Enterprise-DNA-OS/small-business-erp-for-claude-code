# Record checks and their sources

Checked 7 October 2026. `npm run erp -- compliance` checks the records against the rules below and names the source for each finding. It flags gaps in what is recorded. It does not certify legal compliance, file GST, register anything or replace your accountant, lawyer or food safety verifier. When a rule changes, update this page and the check in `scripts/lib/domain.mjs` together.

## Record retention

**NZ.** [Inland Revenue: record keeping](https://www.ird.govt.nz/managing-my-tax/record-keeping) says business records, including electronic records, must be kept for at least seven years. RETENTION_POLICY flags a configured policy under seven years. RETAIN_UNTIL uses the latest of prepared, completed and the recorded period end, plus seven years. SOURCE_EVIDENCE flags a register entry with no archive reference.

**AU.** [business.gov.au: record keeping](https://business.gov.au/finance/payments-and-invoicing/record-keeping) says most business records must be kept for five years. RETENTION_POLICY checks five years and RETAIN_UNTIL uses the later of prepared and completed, plus five. Some records need longer: your accountant sets those dates.

## GST invoice details

**NZ.** [Inland Revenue: taxable supply information](https://www.ird.govt.nz/gst/tax-invoices-for-gst/how-tax-invoices-for-gst-work) requires the seller's GST number on supplies over $200, and for supplies over $1,000 the buyer's name plus at least one identifier: address, phone number, email, trading name, NZBN or website. SELLER_TAX_NUMBER flags a blank GST number. BUYER_DETAILS flags a receivable over $1,000 whose customer has no address, phone, email or tax ID recorded.

**AU.** [business.gov.au: invoicing](https://business.gov.au/finance/payments-and-invoicing/invoicing) says a tax invoice shows your ABN, and you must include the buyer's identity or ABN on invoices for sales over $1,000. SELLER_TAX_NUMBER flags a blank ABN. BUYER_DETAILS flags a receivable over $1,000 whose customer has neither an ABN nor an address.

The tax invoice itself is raised in your accounting ledger. These checks make sure the details it needs are in the records first.

## Selling on credit: the PPSR

A supplier whose terms of trade keep ownership of goods until they are paid for (a retention of title clause) usually needs to register that interest on the Personal Property Securities Register to rely on it if a customer fails. Unregistered, the supplier can rank behind the customer's bank. NZ: [PPSR, Companies Office](https://ppsr.companiesoffice.govt.nz/). AU: [PPSR, Australian Financial Security Authority](https://www.ppsr.gov.au/).

PPSR_REGISTRATION flags an active customer with a credit limit and payment terms but no registration reference. Record the financing statement or registration number with `set customer <code> --ppsr-ref="..."`. Whether your terms create a security interest at all is a question for your lawyer.

## Food recalls and traceability

These checks run when settings has `food_business` on.

**NZ.** [MPI: food recalls](https://www.mpi.govt.nz/food-business/food-recalls/) sets out that businesses operating under a food control plan or national programme, and food importers and exporters, need recall procedures, and must notify MPI within 24 hours of deciding to recall. MPI also expects you to be able to trace food one step back and one step forward, and recommends practice recalls.

**AU.** [FSANZ: food recalls](https://www.foodstandards.gov.au/business/food-recalls) explains Standard 3.2.2 clause 12: a business engaged in the wholesale supply, manufacture or importation of food must have a system to recall unsafe food, set it out in a written document, show it to an authorised officer on request, and follow it in a recall. FSANZ recommends a practice recall to check the plan works.

- RECALL_PLAN flags no recall procedure reference in settings (`setup --recall-plan-ref="..."`).
- MOCK_RECALL flags no practice recall recorded in the last 12 months. `mock-recall <batch>` runs the trace and records the date. The 12 month interval is a house choice based on the regulators' advice to practise.
- SUPPLIER_LOT flags a received batch with no supplier lot number: without it, a supplier's recall notice cannot be matched to your stock.
- `trace <batch>` and `draft-recall <batch>` produce the one step back, one step forward record and the customer notices. A person follows the written plan and contacts the regulator.

## House rules

These are business policies in the demo, not law. Change them with /customise.

- EXPIRED_STOCK: expired stock on hand that is not on hold.
- BACKUP_REVIEW: no referenced backup in the last seven days. It checks the register, not the backup itself.
- EMPTY_ORDER: a released order with no lines.

The fictional demo data breaks most of these on purpose: a five year policy in NZ, a production record with no archive reference, no GST number, a $1,207.50 invoice to a cafe with no contact details, the same cafe on credit with no PPSR registration, no recall plan, a practice recall over a year ago and a sugar lot received without the supplier's lot number.
