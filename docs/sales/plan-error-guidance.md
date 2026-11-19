# Plan: error messages and "go fix it" guidance (v0.2.2)

Decision: ADR 0055 (git-ignored). Branch `hotfix/error-guidance` from main 3781790. One PR into main, then merge main back into dev.

## Facts already established (do not re-derive)
- Sales errors map in `salesError(code, message)` (`src/lib/sales/mutations.ts:9`), used by `salesMutation` (`:44`) and directly by `src/app/sales/house-brief-actions.ts:28`.
- Walk-in/lead/project errors map in `mutationError` (`src/lib/walkin/validation.ts:62`), used by `walkin/actions.ts`, `walkin/finish-mutation.ts`, `walkin/privacy-actions.ts`, and `walkin/project-actions.ts` (project open/cancel).
- `ActionState = { error, field? }` and `ActionForm` live in `src/app/walkin/action-form.tsx`; `ActionForm` already renders a `secondaryAction` link.
- `Notice`/`noticeClass` in `src/components/notice.tsx`; existing notice + fix-link pattern in `src/app/sales/new/new-case-form.tsx:21-27`.
- `nextStep()` (`src/lib/sales/case-progress.ts:33`) returns `allowed`; rendered in `case-header.tsx`, `bkp-progress.tsx`, `bkp-workflow.tsx`. Task links: `taskHref` (`src/lib/sales/tasks.ts:106`).
- Issuer settings `/sales/settings/issuers?brand=…` and permissions `/sales/settings/permissions?staff=<id>` are executive-only.
- 133 sales-reachable (code, errcode) pairs, 101 unmapped; 25 walk-in pairs, 16 unmapped. Prerequisite codes: issuer_configuration_required, approved_contract_text_required, accepted_quotation_required, signed_contract_required, contract_not_awaiting_signature, customer_acceptance_required, inspection_and_acceptance_required, active_project_required, sales_closeout_required, invalid_quotation_house, design_invoice_required, design_plan_required, lead_unavailable, active_unit_required, sales_permission_denied/case_unavailable. Misleading today: independent_refund_approval_required and confirmed_payment_immutable show "ไม่มีสิทธิ์".

## Steps
1. `src/lib/errors/` (or `src/lib/sales/error-map.ts`): table code → `{ message, fix? }`, fix kinds: `issuer`, `permissions`, `task:<name>`, `tab:<name>`, `lead-project`. Resolver `(fix, { caseId?, leadId?, brand?, staffId?, isExecutive }) → { label, href } | undefined`. Keep SQLSTATE fallbacks.
2. `salesError`/`mutationError` read the table; `salesMutation` passes context (case id from `input.p_case_id` when present, session role) and returns `fix`. Same for walk-in project actions (cancel → close-out task).
3. `ActionState.fix?` + `ActionForm` renders it as a link button under the error (`role="alert"` stays on the message).
4. Proactive notices (ADR 0055 §3): BKP case header, next-step card when `allowed` is false, Lead project-cancel form, contract lock task.
5. `src/lib/sales/error-map.check.mts`: parse latest function bodies in `supabase/migrations`, assert every raised code is in the table; assert resolver never returns an executive-only href for a non-executive.
6. Verify: `tsc`, `eslint`, the new check, local browser (Sales + executive) for the four notices and three post-submit errors (issuer missing, cancel project without close-out, lock without approved text). PR lists the full code → message table for review.
7. After deploy: manual (Claude Doc) gets v0.2.2 and a short "เมื่อระบบแจ้งให้ไปแก้" note in chapter 5/appendix.
