# Realistic BKP local demonstration

Created 2026-11-09. Synthetic data only; no real customer, transfer, signature or construction. Owner authorized one complete local scenario. No accounts/roles or issuer settings changed.

## Open the example

- Project BKP-69-136: http://localhost:3000/sales/7759899b-6171-4f26-b4ea-6b0409906833?tab=overview
- Documents: http://localhost:3000/sales/7759899b-6171-4f26-b4ea-6b0409906833?tab=documents
- Money: http://localhost:3000/sales/7759899b-6171-4f26-b4ea-6b0409906833?tab=money
- Quotation: http://localhost:3000/sales/documents/5aa5cf89-a6e0-421f-86d1-dd335e662caf
- Signed synthetic contract: http://localhost:3000/sales/documents/a6f292b0-4de7-476b-b7f1-a01482b6d27e
- Originating Lead: http://localhost:3000/leads/7f9f9068-3b7c-49d7-9ac7-2b5424a7cf3c

Customer: กานต์ ใจดี (ทดสอบ), phone0000000000; fictional address and construction plot A-01 in Nakhon Phanom. Model บ้านอยู่สบาย120: single storey,120sq.m.,3 bedrooms,2 bathrooms,1 kitchen,1 living room and rear laundry. Construction priceTHB1,800,000. Spec rows, exclusions and project terms are demonstration examples, not company-approved standards. Existing synthetic issuer and its standard contract text remain unchanged.

## Demonstrated flow

1. Created a synthetic Lead, opened one Project and one sales case; saved per-project house requirements and fictional contact/site details.
2. Selected120sq.m. standard design packageTHB12,000. Issued three design invoices, prepared synthetic transfers with clearly labeled evidence and confirmed them to issue receipts:3,500+3,500+5,000.
3. Issued a structured quotation with house details, material scope, exclusions and paper contact/site snapshots; accepted it with synthetic evidence.
4. Saved a contract draft from the accepted quotation, additional project terms and six instalments. Verified quotation identity/site carried over and actual confirmed design creditTHB12,000. Locked/numbered and signed with synthetic evidence.
5. Issued the deposit invoice, then recorded simulated inspection/customer acceptance before each later work invoice. Prepared and confirmed each synthetic transfer, producing nine receipts in total across design and construction.
6. Verified agreement settled, no pending requests, six active contract instalments, all issued documents marked synthetic and cumulative receipt money exactlyTHB1,800,000.

| Contract instalment | Gross THB | Design credit THB | New receipt THB |
|---|---:|---:|---:|
|0 — มัดจำวันลงนาม|180,000|0|180,000|
|1 — ฐานรากและโครงสร้างพื้น|360,000|0|360,000|
|2 — เสาและโครงหลังคา|360,000|0|360,000|
|3 — มุงหลังคาและก่อผนัง|360,000|0|360,000|
|4 — งานตกแต่งและติดตั้ง|360,000|0|360,000|
|5 — ตรวจและส่งมอบบ้าน|180,000|12,000|168,000|
|Total|1,800,000|12,000|1,788,000|

Design receiptsTHB12,000 + contract receiptsTHB1,788,000 = total actual simulated receiptsTHB1,800,000. All dates use9 November2026 to run the example; this is not a real construction timeline.

## Execution and limits

`node scripts/bkp-realistic-flow.mjs` executed the business steps through authenticated local HTTP RPCs. Only synthetic Lead creation used direct SQL; evidence uploaded through local storage. The script checks local URL, synthetic issuer and fixture identity, records request inputs/results at `/private/tmp/taraville-bkp-realistic-flow-2026-11-09.json` and resumes the same scenario without duplicating successful operations. Do not remove/replace the journal or rerun against another environment; doing so would create another fixture. No existing fixtures were cleaned up.

An intermediate final assertion expected finance document summaries to contain payloads; corrected it to read each full document and resumed the existing fixture. No flow mutation failed or repeated. ESLint and whitespace checks passed. This round verified API data and ledger outcomes, not browser clicks, print/PDF pagination, other roles or physical devices. Issued/signed documents remain immutable; use the normal revision/amendment paths for further testing.
