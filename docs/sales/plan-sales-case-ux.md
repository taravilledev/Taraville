# Plan — Sales case page UX redesign

Status: agreed 2026-11-04 (grilling session). Tag: R1 (multi-file UI refactor, no business-rule change).

## Problem (observed on local dev, executive fixture)

- `/sales/[id]` stacks 8–12 panels in a fixed order for every status: 38 inputs on a Taraville draft, 78 on a contracted Taraville sale, 116 on a contracted BKP case.
- The main next step is hidden: "ยืนยันจองแปลง" sits at the bottom inside "แก้ข้อตกลงและปิดงาน". The status sequence is never shown.
- The case page never shows which Plot is sold (`sales_case_detail` returns `unit_id` only).
- No money summary (net / received / outstanding).
- Rare correction forms are always expanded: two per receipt, one refund-request form per payment, refund panel even on drafts.
- Read facts and the edit form are shown together; reassignment is the second panel.
- `/sales` list: no search/filter, 54 of 100 rows cancelled, no plot/next step.

## Decisions

| # | Decision | Rejected |
|---|---|---|
| Scope | Sub-project (a) case page first, then (b) list. (c) new-case form and (d) Lead entry later | All at once |
| User | Finance/admin on desktop first; mobile must stay usable (single column) | Mobile-first |
| Layout | **A**: header with status steps + money summary + "ขั้นต่อไป" card, then tabs via `?tab=` (Server Components only) | **B** wizard — post-contract corrections become awkward; **C** reorder + collapse only — still one long page |
| Backend | UI + read only. One local migration adds `unit_label` to `sales_case_detail`. No mutation/write RPC/business-rule change | — |
| Wording | Shorter on-screen labels only; printed document titles unchanged (customer files pending) | Renaming documents |
| Forms | Next-step form open inside the card; other actions in collapsed `<details>` using existing `ActionForm` | `<dialog>` (client JS), separate routes |
| List | Default filter "active" (excludes cancelled/completed); brand/status filter + `?q=` via plain GET form; row shows plot/project + next step | — |

## Next step rules — `nextStep(sale, finance, agreement)`

Pending money confirmations or pending refund approvals always come first. Without the needed permission the card says "รอผู้มีสิทธิ์ …" instead of hiding.

- TRV draft: no net price → fill sale info; else → confirm plot reservation (summary optional).
- TRV reserved: no summary → save booking summary; no booking receipt → receive booking money; else → record signed contract.
- BKP pre-contract: design fee → quotation → customer acceptance → prepare contract → sign (first unfinished).
- Contracted: first unsettled instalment (prepare payment, or awaiting work acceptance); all settled → "ชำระครบแล้ว".
- Cancelled: closeout summary + release plot if still held.

One `next-step.check.mts` covers the branches.

## Tabs

- **ภาพรวม**: customer, plot/house, prices, owner, Lead link; "แก้ข้อมูล" opens the form; reassignment collapsed at the bottom.
- **เอกสาร**: booking summary, design agreement, quotation, contract, print links.
- **รับเงิน**: instalment table (net / received / outstanding), pending confirmations, receipts with a collapsed correction menu each.
- **แก้ไข/ยกเลิก**: unit change, amendments, closeout, release, refunds (one "ขอคืนเงิน" form with a payment picker).
- No finance access: overview only (+ work acceptance when permitted).

## Label changes (screen only)

| Now | New |
|---|---|
| เตรียมรายการรับเงิน / บันทึกรอตรวจรับเงิน | บันทึกเงินเข้า (รอยืนยัน) |
| รายการรอยืนยันรับเงิน | เงินเข้ารอยืนยัน |
| เงินรับที่ยังไม่จัดสรร | เงินเข้าที่ยังไม่ระบุงวด |
| แก้ข้อตกลงและปิดงาน | แก้ไข/ยกเลิก |
| Dates `2026-11-03` | `3 พ.ย. 2569` |

## Steps

1. Migration `sales_case_unit_label` (local only) + schema field.
2. `next-step.ts` + check.
3. Case page header, money summary, next-step card, tabs; move panels into tabs; collapse rare forms; refund form with picker.
4. Browser check on the three fixtures (TRV draft, TRV contracted, BKP contracted) + no-finance inspector.
5. Sub-project (b) list page.
