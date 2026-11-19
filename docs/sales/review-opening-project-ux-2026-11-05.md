# Opening Project UX review — 2026-11-05

Status: review complete; form-flow proposals awaiting owner choice. No application code changed in this audit checkpoint.

## Scope and method

User invoked configured `ux-reviewer` to audit and improve `/sales/new?lead=b16c9ad4-9c84-4f98-bd71-3d0719b01a0f`. Located `/Users/arty/.codex/agents/ux-reviewer.toml`; it uses `/Users/arty/.codex/skills/ux-audit/SKILL.md`. Parent performed live browser observation; reviewer performed source review with UX Pro Max and Web Interface Guidelines. Reviewed the existing house tokens and ActionForm rather than proposing a new visual system.

Environment: authenticated local synthetic Executive, Taraville branch,127.0.0.1:3100 mapped to this checkout. Observed initial blank-unit/default-Lead-customer state, selection of an available unit without submit, screenshots at897x853 and viewport375x812.375px DOM check showed no horizontal overflow. Mobile screenshot capture briefly produced an inconsistent scaled image during viewport reset; do not claim full mobile visual acceptance. No form submitted, no data written; original blank selection and default viewport restored.

## Proposals awaiting decision

### UX01 — Development identity disappears after unit selection

Classification: observed defect. Priority: high.

Evidence: actual `unit_id` selector has49 options in47 development groups in this fixture dataset. Selecting first B3 leaves only “B3” visible when collapsed; its development name is absent elsewhere on the page. Source: `src/app/sales/new/new-case-form.tsx:24–28`.

Consequence: staff cannot easily verify which development their chosen unit belongs to. Counts are synthetic-fixture evidence, not production inventory measurements.

Recommended direction: development first, then available unit, plus a persistent selected-unit summary. The smallest same-flow alternative is including development.name with unit.code in each option's visible label.

### UX02 — Existing-customer decision is exposed before it is needed

Classification: heuristic concern. Priority: high.

Evidence: actual customer selector shows120 options in this synthetic dataset, with new-from-Lead as default. Lead context is only a small name line. Source: `new-case-form.tsx:19,29–31`.

Consequence: extra identity/reuse decision distracts from opening work for the Lead already selected. No real-user testing or production-size inference is claimed.

Recommended direction: show current Lead as the explicit default; reveal same-brand existing-customer selection only via an opt-in action. Preserve manual selection and no phone-based automatic merging.

### UX03 — Draft/reservation boundary is remote from the CTA

Classification: heuristic concern. Priority: medium.

Evidence: the no-reservation explanation is a small helper under unit selection, while the generic Open Project CTA comes after customer selection. Source: `new-case-form.tsx:15,28–33`.

Consequence: creation can be mistaken for reserving the property.

Recommended direction: keep the existing no-reservation explanation next to the submit action, with a more specific draft-only CTA only if the owner accepts the copy. Do not alter reservation semantics.

### UX04 — No-unit state still exposes an impossible submission

Classification: source-confirmed state defect, not browser-reproduced. Priority: medium.

Evidence: empty units render a notice at `new-case-form.tsx:23` and no required unit selector, but ActionForm/submit remain present; createCase defaults missing unit to null, then the RPC rejects it. Source: `src/app/sales/actions.ts:17–24`.

Recommended direction: empty state with relevant catalog/Lead navigation and no create form/CTA; preserve authorization around catalog management.

## Existing behavior to preserve

ActionForm already supplies loading/disabled/error handling. Do not duplicate that machinery. Keep Lead/project hidden-context validation, exact selected Project binding for BKP, same-brand customer/unit rules, permissions, and draft-only property creation. No backend/model change is needed for the proposed UI direction.

## Verification and decisions

No broad accessibility conformance claim or numeric UX score. Loading state was source-reviewed; empty-unit submission and other-role states were not exercised live. BKP creation branch was source-reviewed only in this audit.

Owner choice requested: recommended bounded form-flow changes plus local synthetic browser verification, minimal option-label correction only, or report only. Under ux-audit, changes to form fields/flow/consequential wording are proposed before editing. A selected synthetic browser option will include one actual local Project creation for final acceptance; no production actions or cleanup inferred.

## Approved implementation and verification — 2026-11-06

Owner approved the proposal. Implemented dependent development/unit selection with persistent summary, Lead-default customer source with explicit same-brand reuse, near-submit draft/no-reservation copy, and no form when no available unit exists. Catalog navigation respects can_catalog. Read-only reviewer found no blocker; persistent source Lead context was added. Local browser and render evidence, synthetic draft TRV-S69-0120, and verification limits are recorded in `.docs/SESSIONLOG-project-opening-ux-2026-11-06.md`.

## Owner correction supersedes proposal — 2026-11-06

Owner requested direct plot search/dropdown and automatic use of originating Lead data. Removed development selection and customer-reuse UI. Selected plot details remain visible; location is display/search context only. Implemented and browser-checked without new data; see `.docs/SESSIONLOG-direct-plot-picker-2026-11-06.md`. Earlier development-first/customer-choice recommendations are superseded.

## Optional Project filter supersedes plot-only flow — 2026-11-06

Owner approved two searchable dropdowns after grilling. Project optional, plot required; use existing development parent. All eligible units initially, filter after Project selection, auto-fill parent after direct plot selection, clear incompatible unit on Project change, preserve unit on clearing Project. ADR0032 and `.docs/SESSIONLOG-project-plot-filters-2026-11-06.md` contain decision and verification evidence. No DB change or new fixture.
