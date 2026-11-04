# Business contract — Both brands' sales-to-receipt loops

Status: Owner-confirmed policy baseline, 2026-11-02; independent scrutiny corrections closed and rereview returned ship for this business baseline only. Consolidated from the interview, including the explicit no-expiry correction and financial-visibility clarification. Technical schema/API/authorization transition, estimates and production readiness are not yet approved. See [ADR0027](../adr/0027-sales-to-receipt-before-stock.md), [ADR0028](../adr/0028-sales-ownership-money-and-manual-reservations.md), [the delivery plan](../delivery/plan-sales-to-receipt-first.md) and [the review](../delivery/review-sales-to-receipt-business-2026-11-02.md).

## 1. Delivery and domain boundaries

- Complete BKP first, then Taraville; both brand loops precede the accepted BKP Stock work. Do not drop the second brand or stop at a first receipt instead of supporting the applicable payment cycle.
- Taraville: Housing Development → registered house/Plot → Property Sale. A Lead can have several Property Sales, one unit per sale. Unit identity is not the sale ID or a BKP Project ID.
- BKP: extend existing Project opening through design fees, accepted quotation, contract, instalments, invoice, received money and receipts. Design-fee income can exist without a construction contract.
- Customers can be reused within the same brand by explicit selection. Do not auto-merge by phone or grant cross-brand visibility merely because a person appears in both brands. Issued documents preserve their own customer, payer, issuer and agreement snapshots.
- Job/sale responsibility is separate from Lead ownership. At creation, default responsibility from the Lead Owner; Executive may reassign the job/sale. Lead reassignment leaves existing job/sale responsibility unchanged.

## 2. Access and current-state boundaries

- Admin is the Executive-managed settings surface, not a new role. Financial actions are independently assignable, in addition to the ADR0025 Lead/Stock contract.
- Keep shared Lead reading. **Financial visibility defaults to the current Lead Owner**, with explicit Admin grants for other users/broader scopes. Shared Lead read does not itself grant all financial data, proof-file access, write authority, CSV export or reassignment.
- For the integrated scope, this financial-read boundary covers saved sales/booking summaries, quotation prices, contracts, payment notices, receipts, refund documents and their print routes/proof files. A shared Lead reader alone cannot open or print those monetary documents. This explicitly supersedes ADR0026's earlier shared summary-read/print rule; the old review covered a different scope. Unit-catalog access is separately scoped and does not reveal a customer's negotiated terms or payment history.
- The current Lead Owner used for financial defaults is distinct from the job/sale responsible user and the salesperson name printed on a historical document. A Lead reassignment changes the owner-based default visibility, not operational responsibility or issued snapshots; explicit broader grants remain governed by their own scopes.
- A default is not an irrevocable owner bypass. The technical permission/preset contract must implement the accepted default alongside active membership, current grants and revocation. It must specify read/print/proof/write scopes, ordinary Staff versus Sale starting presets, existing-account transition and no-Lead cases before implementation. No grant/backfill is performed by this document.
- Preparation, confirming receipt of money, issuing documents, correction/cancellation, refund request, refund approval and actual payout are distinguishable actions. A single confirmer may confirm money and issue its receipt when granted both. Refund requester and refund approver must be different users, even when one user has both grants.
- Executive owns Admin/reassignment authority. Permission to view a shared Lead does not allow an ordinary viewer to change its owner or grant another user's financial access.

## 3. BKP design fees

Owner accepted these editable starting values; they originate in demo `src/lib/project-rules.ts:58–79`, not an independently verified company tariff document. Actual area selects the tier over a provisional tier card.

| Usable area (m²) | Total THB | Three starting instalments THB |
|---|---:|---|
| Below 150 | 12,000 | 3,500 / 3,500 / 5,000 |
| 150 to below 200 | 25,000 | 7,500 / 7,500 / 10,000 |
| 200 to below 250 | 30,000 | 9,000 / 10,000 / 11,000 |
| 250 through 300 inclusive | 40,000 | 12,000 / 13,000 / 15,000 |
| Above 300 | Enter agreed amount | Enter agreed plan |

- Authorized users can adjust a job's fee amounts before receiving money, without changing historical receipts. Design-fee payments may issue receipts directly, without a preceding invoice or construction contract.
- At contract signing, snapshot the agreed credit from net design-fee money actually received, excluding money already refunded. Credit applies to the final construction instalment first, then preceding instalments backward if needed; do not discard excess or produce a negative instalment. Total credit cannot exceed Contract Value.
- Display the agreed credit allocation in the signed payment schedule. Later fee refunds/adjustments require explicit approved credit/billing adjustments; do not silently recompute the original signed schedule.
- Credit is allocation of money already received, not a new cash receipt. When an instalment's net amount due is zero after credit, support a no-new-money settlement path: retain gross amount, applied credit and zero balance; settle its collection obligation without confirming another payment, issuing a zero-value receipt or counting the original money twice. This does not complete construction work or bypass its inspection/customer-acceptance gate. The exact document/status/RPC representation remains technical design work.

## 4. BKP quotations, contracts and work instalments

- Explicitly select the quotation revision accepted by the customer before creating the contract. The latest saved revision is not automatic evidence of acceptance. Preserve the agreed content and subsequent revisions/history.
- Use company-approved contract content and signed evidence. Demo clauses 3–14 remain placeholders and are not deployable legal wording (`demo/src/lib/contract-template.ts:1`).
- Starting schedule: signing deposit 10%, then five construction instalments of 18% at 20/40/60/80/100% progress. Pre-signing number/percentages are editable, sum to 100%, and arithmetic remainder goes to the final gross instalment before the agreed design-fee credit allocation. This supersedes the older tracker default of 10/20/25/25/20.
- Deposit billing follows recorded contract signing, with no construction QC prerequisite. Work instalments require recorded inspection and evidence of the customer's acceptance before invoicing. Authorized staff can record the real evidence without a LINE portal; do not fabricate acceptance or bypass the gate.
- After signing, changes to price, work or instalments use documented agreed amendments with reasons/evidence and appropriate capability. Keep the original agreement; explicitly correct or cancel affected issued bills instead of editing history.
- Cancellation after signing requires authorized approval, reason and close-out agreement specifying retained/remaining amounts, refunds and affected documents. Stop new work-instalment billing. Existing money/receipts and refund obligations remain; cancellation is not automatic debt erasure or payout.

## 5. Money, receipts, refunds and document corrections

- Exact nonnegative THB, at most two decimals; blank and zero are distinct. Derived totals are authoritative server-side, with matching database bounds and validation. No silent extra-precision rounding on input.
- Contract/sale invoices can receive multiple partial payments; each confirmed payment has its own receipt. Show the allocated received total and remaining billed amount. Reject ordinary confirmation above the billed outstanding amount; a real unmatched/overpaid transfer must not be falsely marked as rejected by the bank or quietly allocated to another customer.
- Confirmation of actual money and numbered receipt issuance are atomic and replay-safe, requiring both capabilities. Another user may prepare the record or evidence before confirmation. Concurrent confirmations cannot over-allocate an invoice or reuse a receipt number.
- That confirmation/receipt path is for positive actual money only. A credit-covered zero balance is not an overdue cash claim and must not enter money-chasing/reminder work as unpaid, generate a new receipt number or invent a payment merely to close an instalment. Replaying its settlement cannot duplicate the existing credit or income.
- Cash records actual receipt date/person; transfer and cheque require evidence plus authorized confirmation of actual funds. Uploading a slip or holding an uncleared cheque is not itself receipt of money.
- Basic partial/full refunds reference money actually received, not planned amounts, and cannot exceed the still-unrefunded amount. Separate request → approval by another user → recorded payout with evidence. Reserving/approving a refund is not actual payout, but must be considered to prevent concurrent over-refunds.
- A cancelled receipt is a retained, numbered document with reason/history; it is not a cash refund. The technical contract must distinguish document-only replacement, correction of an erroneous financial record and actual refund, including invoice balance and design-fee-credit effects. Document status alone must not erase or duplicate actual funds.
- Maintain one authoritative financial accounting of receipts/payments, allocations, refunds and authorized corrections; do not sum invoice status and receipt totals as separate income. Pick the concrete ledger/schema in the technical design and review it against these invariants.
- Refund amount is explicitly authorized; do not invent automatic forfeiture/penalty calculations. Agreed contract close-out/adjustments determine its effect on remaining obligations. No tax-invoice or statutory retention claim is made here.

## 6. Taraville registration, sales and manual reservations

- Maintain Developments and their saleable houses/Plots. Populate the sale from the selected registered unit; authorized users can adjust the sale's price/promotion/discount without editing the unit's master price. Later master changes cannot rewrite existing offers/contracts.
- A draft does not reserve a unit. Authorized booking confirmation reserves an available unit before money is necessarily received. Enforce one conflicting active commitment per physical unit, including concurrent calls.
- **No expiry date, expiry task, automatic release or timeout workflow in this increment.** The owner explicitly replaced the earlier expiry suggestion with manual cancellation/release. Keep reserved-but-unpaid units visible for staff review; do not make those units look available.
- Authorized cancellation plus explicit release makes the unit saleable again. Release can precede completing a refund; the old sale, money, documents and refund due remain traceable. Cancellation and release must not erase actual receipts or approved refund obligations.
- Before signing, changing units checks availability and acquires the new unit/releases the old atomically. Preserve the sale/payment history and obtain agreement to new price/terms. After signing, use a documented agreed amendment without overwriting the original unit agreement.
- Payment plan: booking → contract amount → downpayment instalments → remaining balance. All are parts of Net Sale Price; previously received booking money must be counted rather than collected again. The balance may be paid by customer/bank; an application-for-loan amount is not a confirmed bank payment.
- Owner explicitly confirmed that actual Taraville booking money may issue a direct receipt against the confirmed booking before a sale contract, without a preceding invoice. Use the same atomic confirmation/receipt and both-capabilities requirement. Allocate the money to the sale's booking component; do not create duplicate income when later contract/downpayment invoices are issued. A payment does not silently resurrect a released unit commitment; late/unmatched money needs the reviewed exception/refund path.
- Net Sale Price follows ADR0026's agreed promotion-or-list-price minus additional discount semantics. Keep the house/area/condition/freebie fields from the supplied paper; labels may be seeded, sample personal data/fees/promises may not.
- Documents: booking/Sales Summary, company-approved sale contract, payment notices for contract/downpayment/balance, actual receipts and refund documentation where applicable. Printing a draft neither reserves a unit nor confirms money received.

## 7. Identity, preservation and print

- Separate reusable customer information, Lead information, responsibility and immutable issued-document snapshots. Current names/phone/address changes do not rewrite issued contracts or receipts; the payer may differ from the customer.
- Ordinary Lead deletion must block where an issued contract/payment document needs its history. Do not cascade ADR0026's summary-only deletion policy into this scope. Define controlled data-rights/preservation operations separately against company-approved policy; do not choose a statutory or indefinite retention period by assumption.
- Ordinary Lead removal must also block while any active reservation/commitment depends on that Lead, even before a document or money exists. It must neither release a unit nor sever the Lead/ownership link used for financial access. Use authorized manual cancellation/release first or a separately reviewed preservation procedure; never a cascade that bypasses the accepted release workflow. Historical reservation/audit handling remains part of that controlled procedure.
- Keep cancelled document numbers and history. Correct an issued document through the reviewed correction path; never delete it or reuse its number. Brand-specific identities/numbering and actual issuer details need verification in the technical contract.
- Reuse A4/browser print with appropriate branding, reference/date and saved version/status. Print saved/issued snapshots, not unsaved fields. Long rows, Thai fonts and pagination need actual PDF/browser tests. Downloaded or printed copies cannot be erased by changing the source record.

## 8. Design and readiness gates still open

- Exact tables/RPC/actions, money representation, allocation/refund/credit adjustment semantics, capability matrix/default/revocation/transition contract, brand-scoped customer lookup and safe migration/rollback remain technical design work. No detailed schema choice is approved just by accepting this business baseline.
- Verify real issuer information and obtain company-approved BKP and Taraville contract templates/clauses and acceptance evidence formats; do not ship placeholder text. Existing sources must be checked before asking the owner to resupply a fact already available.
- Signed unit changes and close-out must map to explicit agreement/document/financial operations. Do not call an unspecified mutation safe because the business direction is accepted.
- Estimate/rebaseline the delivery order without pretending the prior Stock commitment is already feasible. LINE/portal and wider construction/profitability scope remain separately mapped; required customer acceptance is manual and evidenced in this increment.
- Independent scrutiny and written-artifact rereview of this consolidated baseline returned ship after all three initial findings were corrected. A subsequent [fresh plan review](../delivery/review-sales-to-receipt-plan-2026-11-02.md) added the zero-net-credit settlement invariant and acceptance cases; its correction was independently rereviewed and closed with ship for the business/delivery baseline, allowing technical design to begin. Source/document checks are not HTTP/browser/real-money/production verification. No migration, account/grant, commit/push or deployment is authorized here.
