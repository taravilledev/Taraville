# Plan — Taraville Lead Sales Summary

Status: Reviewed planning draft, 2026-11-02. Owner accepted the scope and all four review-policy decisions. No application code, migration, production write or delivery estimate is included.

Superseded delivery route, 2026-11-02: the owner chose both brands' complete sales-to-receipt loops before Stock in [ADR0027](../adr/0027-sales-to-receipt-before-stock.md). Use [the new delivery plan](../delivery/plan-sales-to-receipt-first.md) for next work. This document remains the reviewed standalone-summary requirements baseline; its prior review is not a verdict on the expanded financial scope.

Superseded authorization: [ADR0028](../adr/0028-sales-ownership-money-and-manual-reservations.md) and [the consolidated business contract](sales-to-receipt-business-contract.md) now govern integrated sales-summary/quote/booking/financial-document reads and print. Shared Lead reading alone no longer authorizes those monetary-document routes. Follow the current Lead Owner financial default and explicit Admin grants; do not implement the historical read/print rules below for the integrated feature.

## Goal and boundary

From a Taraville Lead, save one editable house-and-land Sales Summary and print saved information as A4/browser PDF. Follow [ADR0026](../adr/0026-taraville-lead-sales-summary.md). This is a sales-information document, not a reservation, invoice, receipt, signed contract or actual-payment ledger.

This was an extraction from Phase 4/F4.5, with a new Taraville Lead entry point beyond Phase 1B's BKP conversion. The earlier proposed after-Stock slot is superseded by ADR0027. Reuse this form within the new integrated flow after reviewing its relationship/lifecycle rules; do not implement it independently merely because this older checklist exists.

## Confirmed facts — do not re-derive

- Current Lead detail loads an authenticated Lead and computes owner/Executive editing (`src/app/leads/[id]/page.tsx:23–25`). Shared Lead reads are defined by `supabase/migrations/20261030093616_walkin_shared_lead_read.sql`.
- Existing Project UI and DB conversion are BKP-only (`src/app/walkin/project-controls.tsx:13`, `supabase/migrations/20261023140000_walkin_bk_lead_project.sql`). They cannot be repurposed by merely showing a button for Taraville.
- Contact data has no nickname (`src/lib/walkin/models.ts:8`). Address is optional survey data (`src/lib/walkin/survey-questions.ts:9`). The survey salesperson value is overwritten with the latest saver (`src/app/walkin/actions.ts:17`), so it is not a reliable current-Lead-owner lookup.
- Controlled removal currently handles Lead/privacy/status data and guards Projects, not sales-summary snapshots (`supabase/migrations/20261023140000_walkin_bk_lead_project.sql:215–235`). ADR0010 retains quiet Project/buyer Leads in review and distinguishes contact recording from other actions.
- Existing mutations use stale-version conflict handling; reuse that discipline, not a new client-only overwrite path (`src/app/walkin/actions.ts:31`, `supabase/migrations/20261021040439_walkin_stale_conflict_http.sql:10`).
- Browser-print UI already exists (`src/app/leads/report/print-button.tsx:6`, `src/app/leads/report/report.module.css:30`). Reuse its pattern; no PDF library or background document generator is needed.
- ADR0025's per-action Lead grants and own/all scope are accepted but unimplemented. At implementation time use the actual owning authorization contract; ownership alone must not bypass revoked permissions.
- Evidence is local source/document review, not proof of the current remote schema or deployed runtime.

## Owner-confirmed behavior

1. Taraville-only sales tab. One summary per Lead, editable at any time; no formal confirmation/locking step.
2. Initially current Lead owner Sale and Executive edit; other authorized Sale readers can view. Reads and print use Lead-view authorization; create/update use Lead-edit authorization. Do not grant CSV/report/export rights as a side effect.
3. Copy available personal data only on initial creation. Keep the copy editable and independent of later Lead changes. Reassignment changes authorization immediately; it does not rewrite the displayed salesperson snapshot.
4. Save/read/print do not call `openProject`, close/reopen the Lead, mark `bought_with_us`, alter derived Stage or renew `last_contact_at`.
5. Conditions and freebies support adding/removing rows using the supplied paper as a layout reference. Seed field labels, never its personal data, example prices/fees or unapproved freebie promises.
6. Owner-approved controlled Lead removal deletes the summary atomically with its Lead. Preserve existing Project guards, stale checks and operational approval; do not execute removal or introduce a UI delete action in this planning work. Summary existence neither creates a permanent hold nor removes the Lead from retention review.
7. Printed/downloaded copies cannot be revoked or erased by deleting the app record. No archive of historical summary contents is included.

## Field and source contract

| Group | Fields / initial source |
|---|---|
| Identity | Permanent summary ID/reference generated once; editable document date; saved version and updated-at metadata |
| Customer | Name and phone from Lead contact; nickname initially blank/manual; address from optional `survey.address`, otherwise blank |
| Salesperson | Current `staff` display name for `lead.owner_id` at first creation, not the survey's last-saver field; resolve absence honestly as blank |
| House/land | Housing Development, house model, Plot, storeys, bedrooms, bathrooms, usable area (square metres), land area (square wah); manually entered |
| Price | List Price, optional Promotion Price, Additional Discount, derived Net Sale Price, independent Mortgage Application Amount |
| Planned payments | Booking amount/date, contract amount/date, downpayment count, amount per instalment, first due date, derived downpayment total |
| Conditions | Ordered editable labels/details, including fee amounts or responsibility text where appropriate |
| Freebies | Ordered editable item/specification, quantity/unit and installation details as applicable; no inventory linkage |

Do not add nickname to the Lead schema solely to fill this document. Displayed snapshot values never authorize requests. Treat all manual values as untrusted text; validate bounds and escape them in views/print.

## Money, drafts and print

- Distinguish absent values from explicit zero; a zero Promotion Price is supplied, not absent. If the base price is absent, Net Sale Price is absent. Blank discount means no additional discount for calculation. Display missing optional inputs as `—`.
- Accept nonnegative money with at most two decimal places; reject extra precision rather than silently rounding. Use exact decimal/minor-unit arithmetic with supported bounds and matching server/DB validation; do not calculate money using unchecked floating-point values. Choose the concrete storage representation in the implementation contract, without importing unresolved Stock accounting rules.
- Effective Price = Promotion Price if supplied, otherwise List Price. Net = Effective Price − Additional Discount. Discount cannot exceed a known Effective Price. Recalculate authoritative outputs server-side; ignore submitted derived totals.
- Downpayment count is a positive integer when supplied. Incomplete drafts may omit count or per-instalment amount; the total stays unknown until both exist. Reject negative values and otherwise invalid known values even in drafts.
- Booking, contract and downpayment are planned components, not a paid balance. When Net is known, reject a known component or known-component subtotal above Net, including before all other components are completed. Once all components are supplied, their total must not exceed Net. Do not turn incomplete unknown components into printed zeros or infer an actual remaining balance.
- Mortgage Application Amount is not constrained to equal the plan remainder; no loan approval or actual collection is implied.
- Drafts may omit data. Print only a successfully saved version with customer name, Housing Development, Plot, document date and valid Net Sale Price; other fields may remain blank. Explain missing requirements rather than inventing values.
- Document and appointment dates are date-only values; display Thai/Buddhist-calendar dates consistently without timezone shifts. Printed saved-version/update metadata identifies the saved content separately from document date and print time.

## Minimal implementation reach

1. Data: standalone summary identity, unique Lead relationship, editable snapshot/payload, its own version and audit timestamps. No unused Project relation. Future linkage is a separately reviewed extension; one editable summary does not promise multi-purchase support.
2. Authorized access: authenticated queries and transactional mutations with current staff/Lead scope, TARAVILLE check, matching database enforcement, trusted owner resolution and safe user-facing errors. Direct IDs, hidden tabs and print URLs must not bypass access.
3. Concurrency: unique `lead_id`; concurrent first-create/retry returns or conflicts against the existing record without replacing it. Compare-and-swap updates reject stale versions. Reuse request replay protection where applicable; a replay must not reset snapshots or prices. Coordinate with Lead locks/reassignment and controlled removal.
4. UI: house components and current form/server-action conventions; unsaved edits cannot silently enter a printed document. Show that print uses saved data, or require save before opening it. Keep data visible when save fails.
5. Print: A4 portrait, existing Taraville branding, section order matching paper, multipage overflow without clipped rows or blank-page regressions; stable reference plus saved-version/update timestamp. Clearly identify the summary as planned terms, not evidence of payment.
6. Lifecycle: extend the existing controlled-removal transaction to cover the summary with no orphan PII and no unintended bypass of Project blockers; retention review and contact recording remain unchanged.

## Ordered gates and acceptance

- [ ] Confirm scheduling/effort independently; read relevant installed Next.js guides before framework implementation.
- [ ] Write the narrow schema/RPC/action/authorization contract and safe migration/rollback plan against the actual owning permission model; check historical notice coverage for the new data purpose without inventing a retention period or legal claim.
- [ ] Implement persisted data/mutations plus a small meaningful money/concurrency/permission check using the repository's existing check style; no new dependency/test runner.
- [ ] Verify exact arithmetic, blank vs zero Promotion Price, over-discount, excessive planned subtotal, incomplete draft, positive integer instalments and independent mortgage amount. Assert authoritative saved/printed values, not just form intermediates.
- [ ] Verify via real authenticated HTTP: TV allow/BKP deny; allowed reader vs editor; forged IDs/brand/derived totals; inactive user; reassignment; withdrawn grants if ADR0025 exists; direct print access; concurrent create, stale save and response-loss retry.
- [ ] Verify approved synthetic controlled removal atomically removes summary/Lead, rollback preserves both, Project guard remains, saving/printing never alters Stage/contact/closure. Production removal requires separate exact approval and is not a test fixture assumption.
- [ ] Before final browser verification ask the owner to choose browser tool, human checklist or skip. Check actual save/reload, print of saved rather than unsaved data, Thai fonts, long text/rows, A4 PDF pagination and tablet portrait/landscape. Report device/PDF/browser gaps honestly.
- [ ] Update tracker/session log after implementation. Commit, push, migration application and deployment require their own authorization.

Review: [2026-11-02 scrutiny and remediation](../delivery/review-taraville-sales-summary-2026-11-02.md). No runtime acceptance is claimed by this plan.
