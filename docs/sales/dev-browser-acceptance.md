# Sales-to-receipt browser acceptance on local dev

Use `npm run dev:local` and open `http://127.0.0.1:3100`. Use synthetic leads, issuer text, accounts and proof files. Prepare one Executive, one Lead owner with the financial actions needed for testing, and one responsible user with acceptance access but without financial view.

| Flow | Browser actions | Expected result |
|---|---|---|
| Taraville entry | Open a Taraville Lead, choose **เปิดรายการขายใหม่**, and select an available plot. Return to the Lead. | The Lead is preselected, its sale appears in the list, and the draft leaves the plot available. |
| Taraville booking and contract | Confirm reservation, save the booking summary, print it, then prepare and confirm booking money. Select that summary, attach signed evidence, and save a contract with three down instalments. | The summary shows the selected plot and saved prices, with blanks distinguished from zero. The contract shows booking credit, three down instalments and the final balance. Only the actual booking receipt has been issued so far. |
| Taraville full collection | Issue the contract-day and down instalment bills, then the final bill. Confirm the actual amounts and open the receipts. | Every bill shows its outstanding balance and the case displays settlement after all rows are settled. Receipts total the contract amount including the original booking payment. |
| BKP work and collection | Open an existing BKP Project, record design money, accept a quotation, and record a signed contract. Try issuing a work bill before acceptance. Sign in as the responsible user to record inspection and customer acceptance, then issue and collect the bill. | Work billing is gated on acceptance. The responsible user sees acceptance controls and no financial detail. Design credit applies from the end of the schedule. A credit-covered row adds no receipt. |
| Corrections and refunds | Correct receipt wording, then correct an actual amount on an issued receipt with evidence. Request a refund, approve from a different account, and record payout. | Each replacement links the original number. Only the amount correction changes recorded income. Approval leaves money unchanged until payout. |
| Cancellation and release | Record a signed close-out on a reserved sale, then release the plot separately. | Old bills are cancelled, receipts remain visible, and the plot becomes available after release. |
| Print and access | Open print preview for a Thai booking summary, contract, payment notice, receipt and refund. Save representative PDFs. Try opening the financial document URL from the responsible account. | A4 output preserves readable Thai text, numbers and page breaks without clipping. Controls are hidden on paper. Document access is denied without finance view. |

## Observed on local dev

The owner selected browser verification with synthetic data. The following runs used desktop Chrome and an Executive test account. The exact viewport dimensions were not recorded.

| Case | Observed in Chrome | Remaining browser verification |
|---|---|---|
| Taraville `TRV-S69-0080` | Opened the sale from its Lead, reserved the plot, saved summary `TRV-SU69-0062`, confirmed booking receipt `TRV-R69-0118`, attached signed evidence, and recorded contract `TRV-C69-0033`. Issued bills and collected the remaining instalments through the settled case state. | Reprint the contract after the signature label correction. |
| BKP `BKP-69-060` | Created the Lead and Project and opened the linked financial case. Issued the 3,500.00 THB design receipt `BKP-R69-0140` and accepted quotation `BKP-Q69-0047` for 600,000.00 THB. Verified signed contract `BKP-C69-0047` and issued deposit receipt `BKP-R69-0141` for 60,000.00 THB. Work instalment 1 exposed invoicing only after inspection and customer acceptance. Receipt `BKP-R69-0142` settled that instalment at 108,000.00 THB with zero outstanding. The final instalment shows the 3,500.00 THB design credit and 104,500.00 THB net. The owner selected the synthetic files in Chrome. Recorded acceptance, issued invoices, and confirmed payments for work instalments 2–5. Receipts `BKP-R69-0143`–`BKP-R69-0146` settled those instalments, and the case displayed full settlement. All seven receipts total 600,000.00 THB. | Saved payment notice PDF and restricted-role browser verification remain pending. |

The Taraville booking summary and BKP design receipt were saved as single-page A4 PDFs. The saved Taraville contract is also single-page A4 and still shows the old construction signature labels. The updated print page shows buyer and seller labels. Payment notice and refund PDFs, correction and refund interactions, release after close-out, and access under the responsible user's account still need browser evidence.

The local HTTP suites exercise permissions, mutations, replay, booking conflicts, reconciliation and print HTML. They do not exercise user interaction, client upload behavior, browser pagination or saved PDFs.

The isolated in-app browser verified the restricted inspector on synthetic case `BKP-69-039`. The account had only the case-scoped acceptance capability, saw the operational view without financial details, uploaded proof, and saved work instalment 1 as accepted. Direct navigation to payment notice `BKP-I69-0148` displayed the not-found page under that account.

Chrome verified the receipt replacement chain `BKP-R69-0142` → `BKP-R69-0147` → `BKP-R69-0148`, including the original references and the 1.00 THB balance after correcting actual payment. For `TRV-S69-0079`, a separate Executive approved the synthetic refund and recorded payout with evidence. Refund document `TRV-RF69-0014` showed the 0.01 THB cash payout. The signed closeout `TRV-CL69-0039` cancelled six invoices, preserved seven issued receipts, and a subsequent explicit release cleared the active A3 reservation in the local database.
