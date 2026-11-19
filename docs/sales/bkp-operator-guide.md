# Baan Kunapap operator guide

> **Deprecated (2026-11-19).** Superseded by the Thai user manual for v0.2.0 (Claude Doc "คู่มือใช้งานระบบ Taraville ฝั่งบ้านคุณภาพ": https://claude.ai/artifact/JPYqUymxEtMLsWnEKaojfs). Kept for history; some labels below no longer match the UI.

Use this guide for one project, from the customer’s first enquiry to the last receipt. Thai text in bold matches the staff interface.

## Before starting

- Use the staff app and choose **บ้านคุณภาพ**. Work in localhost with fictional data when practising.
- Assign an active salesperson as Lead owner. Confirm that the people responsible for billing, inspection, signing and receipt confirmation can see their respective actions. Seeing the project alone does not grant those actions.
- For real work, confirm the company’s issuer details and approved contract text before offering documents for signature. The current local issuer is synthetic and its contract text is unapproved. For transfers or cheques, have payment evidence available. Have separate evidence of quotation acceptance, contract signature and work acceptance ready as each step occurs.

## Start a project

1. Open **รับลูกค้า → บ้านคุณภาพ**. Enter the customer’s name and phone number. Record LINE ID if available. Sales enters their own Lead; an executive selects the active salesperson responsible.
2. Present the privacy notice and record the customer’s actual request for follow-up. Ask separately whether they agree to the optional survey. If they decline, continue with the contact information. Select **บันทึกข้อมูล**. The Lead detail page should show **บันทึกแล้ว**.
3. Select **เปิดโครงการ** on the Lead, confirm that this is the correct customer and select **ยืนยันเปิดโครงการ**. Check the new BKP code before entering prices or accepting payment. One Lead can have multiple projects, each with its own financial documents.
4. Check **ความต้องการบ้าน** and the construction address. Enter the customer’s correspondence address separately when required. If project opening was interrupted, check **โครงการ** on the Lead and use **ดูรายละเอียด** on the existing project before trying to create another.

## Design fee, quotation and contract

| Step | What to do | What confirms it worked |
|---|---|---|
| Design | Open **ออกแบบ → กำหนดค่าออกแบบ**. Select a package and enter **พื้นที่ใช้สอยจริง (ตร.ม.)**. Review the tier and instalments before saving. | The design tab shows the selected package and area. Finance shows the fee instalments. |
| Design billing | In **การเงิน → ค่าออกแบบ**, select **ออกใบแจ้งชำระ** on the correct row. Enter the due date, preview, then **ยืนยันออกใบแจ้งชำระ**. | The row shows a bill number/document link and remains unpaid until the receipt process below. Each design bill takes one payment for its full amount. |
| Quotation | In **ใบเสนอราคา**, select **จัดทำใบเสนอราคา**. Review customer, site, area, quantities, materials and scope. For a new quotation, enter the construction price only. Preview and **บันทึกเป็นฉบับใหม่**. | The document has a revision and price. An estimate without a price cannot be used as the basis for a contract. |
| Customer acceptance | Choose the exact priced revision and **บันทึกลูกค้ายอมรับใบเสนอราคา**. Select and upload the customer’s acceptance evidence, then tick the confirmation and save. | The selected revision shows that the customer accepted it. |
| Contract | In **สัญญา**, create the draft from the accepted revision. Check the parties, construction period, terms and full instalment schedule. Percentages must sum to 100%. Use **ตรวจความพร้อมก่อนออกเลข** and then **ล็อกและออกเลขสัญญา**. | The numbered contract and schedule are available to review and sign. |
| Signing | Obtain the signatures, then use **บันทึกลงนามสัญญา**. Upload the signed contract and schedule, tick the confirmation and save. | The contract status is **ลงนามแล้ว**, and **การเงิน → งวดตามสัญญา** shows the collection schedule. |

New construction-only contracts keep design fees on separate bills, even after signing. The project value in **ภาพรวม** adds both components once. On an older signed contract that already includes the design fee, follow the signed schedule and the credits shown in the original document.

When the parties agree to additional terms after signing, use **สัญญา → เพิ่มเอกสารแนบท้าย**. Review and print the draft, then record the signed addendum with its evidence. Use the separate contract-amendment action for changes to instalment amounts.

## Collect and issue receipts

1. In **การเงิน → งวดตามสัญญา**, issue the signing deposit bill. Later work instalments start with **บันทึกตรวจรับ**. Record the actual inspection date and customer acceptance, upload evidence and save. For contracts using the 30-day term, the work bill is due 30 calendar days after that inspection date. The signing deposit and design bills have their own due dates.
2. Select **ออกใบแจ้งชำระ** on the work row and confirm the bill. Check that the bill belongs to the correct project and instalment. Issuing a bill does not record received money.
3. Select **บันทึกรับเงิน** for a design bill, or **บันทึกเงินเข้างวดนี้** for a contract bill. Enter the actual payment date, method and payer. Use the full design bill amount. A contract payment can be partial up to the outstanding amount. Upload evidence when required, preview and send for confirmation.
4. An authorized user opens **เงินเข้ารอยืนยัน → ตรวจใบเสร็จและยืนยันรับเงิน**. Compare the money actually received, bill, date and evidence. Select **ยืนยันรับเงินจริงและออกใบเสร็จ**. The pending item should leave the queue, the received amount should update and the row or receipt history should show the numbered receipt.
5. Open **ดูบิล**, **ดูใบเสร็จ** or **เอกสารทั้งหมด** and select **พิมพ์ / PDF** when needed. The invoice and receipt templates are configured for A5 landscape. Check the output in print preview before delivering a document.
6. At the end of a project with separate design billing, in **การเงิน**, check **ค่าแบบคงเหลือ = 0**, **งวดสัญญาคงเหลือ = 0** and **เงินเข้ารอยืนยัน = 0**, then match the receipt history to the amounts actually collected. A notice that all contract instalments are paid can appear while a separate design balance still remains.

## If an action is missing

| Symptom | Check |
|---|---|
| No project action | Open the correct Lead and check ownership or the project-opening grant. When a project card already exists, open that card. |
| Cannot create or lock contract | Check for an accepted priced quotation, complete contract details and an approved issuer template for real use. |
| Cannot issue a work bill | Check that the contract is signed, the work row has recorded inspection/customer acceptance, and the account can issue bills. |
| Cannot collect design after signing | Confirm the signed quotation and contract use the separate-design policy. For an older contract, check the signed schedule before charging anything separately. |
| Payment stays pending | Ask the reviewer to confirm the payment and issue the receipt. If the information is wrong and the payment is still pending, use the available withdrawal action and prepare it again. |

## Local practice cases

- [BKP-69-141 Finance](http://127.0.0.1:3117/sales/e6c852e8-4d5c-4e64-a83b-4a1723c448b5?tab=money) for the new separate-fee model. The project is already signed. On audit readback, it had THB 7,000 in design receipts and THB 5,000 in design still outstanding. Open a fresh synthetic Lead to practise the intake and quotation steps.
- [BKP-69-136 Documents](http://127.0.0.1:3117/sales/7759899b-6171-4f26-b4ea-6b0409906833?tab=documents) for completed document history under the older combined-price model.
- For a full new-policy practice case, use 120 sq.m., THB 12,000 design and THB 2,000,000 construction. With one payment per bill, expect three design receipts and six construction receipts, totalling THB 2,012,000 when everything has been confirmed.
