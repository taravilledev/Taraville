# Simple BKP design billing

Status: locally implemented; HTTP, source readback, render/type/lint and read-only browser checks passed, 2026-11-09. Decision: ADR0039.

## Confirmed facts

Design plans already store three exact-cent amounts. Existing confirmed receipt payments feed design credit. Pending payments do not count as collected. Construction invoice issuing requires a signed contract and cannot be reused directly for pre-contract design bills. Current financial roles and confirmation/evidence rules are retained.

## Work

1. Backend: separate design invoice bindings, issue/cancel/prepare APIs, exact full-bill guard, one pending per bill, design edit lock and financial read model.
2. UI: one three-row panel, distinct not-billed/unpaid/pending/received states, amount readonly, due date explicit, invoice/receipt links and cancelled history.
3. Integrate task registry, actions, general-payment routing, and existing confirmation view without making design collection a quotation/contract prerequisite.
4. Local migration/source readback; HTTP replay/validation/auth/concurrency/receipt/lock checks and relevant regressions.
5. Ask owner for each browser verification round under agent-guide section4; exercise full synthetic flow and mobile only when approved.

## Deferred

Partial/overpayments, post-payment package amendments, automatic issuing/due dates, production rollout, physical print/PDF. No guessed linkage for historical design payments.


## Verification and review fixture

- Applied only local Docker migrations20261108173822/20261108173945; all13 authored function bodies match source readback and design table RLS is enabled.
- HTTP issue/cancel/replay/full-only/old-endpoint-bypass/pending-race/withdraw/actual-confirmation/receipt/locks/anonymous-denial passed. No allocation to contract invoices was created.
- One synthetic case BKP-69-133: b7819444-1454-4f80-a21a-db380fdb2099. Review state: first bill received3500, second bill unpaid3500, third bill pending5000; confirmed received3500, total12000, outstanding8500. Five invoice documents including two cancelled history and one receipt. No new account/role changes.
- Browser checks: desktop and375px panel, history/cancelled document, required blank due date and nonmutating date edit, fixed-amount prepare form, cancel reason/confirmation, pending confirmation entry point and receipt3500. No browser submit/upload or native print.
- Static regression/task/render tests, pending-guard sensitivity, TypeScript, scoped ESLint and diff checks passed. Existing restricted-account HTTP check skipped because no matching active synthetic staff account was found; no account created. Legacy unlinked design histories remain intact/readable but no new bill linkage guessed.

## Remaining release boundary

Production deployment/migration, actual browser submission/upload, restricted-role/cross-case mutation HTTP negatives and physical print/device checks are not verified. Older general money suites assume direct unbilled/partial design receipts and were not rerun unchanged against this intentionally superseding flow.
