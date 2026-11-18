# Guided BKP workflow and paper editors

Status: implemented and checked on Docker local/localhost, 2026-11-09; production release pending. Accepted ADR0040; prior safeguards ADR0035/0038/0039 retained.

## Confirmed facts

- Lead intake seeds per-project house requirements. Quotation already has a native A4 editor and immutable revisions.
- Contract currently has separate wizard; accepted quotation binds price/spec/schedule and actual design credit. Locking issues a number; signing activates instalments.
- Design invoice, payment preparation and actual confirmation are separate. Full design bill is fixed; pending is not received. Prior issued documents remain intact.
- Four tabs keep project facts, design bills, document history and money accessible without a long aggregated page.

## Work and ownership boundaries

1. Record precise domain terms and ADR. Five-stage overview selector; one selected stage's context and actions; no new collection prerequisite.
2. Contract native paper editor and four-section preview, optional project additional terms, selected accepted-quotation customer/site defaults, unchanged standard terms and monetary guards. Uses the contract-terms migration and a template-read volatility correction, both applied and read back only on Docker local.
3. Invoice and receipt preparation templates with native fields, readonly preview, evidence and final explicit existing action; actual confirmation remains authorized and preview is clearly unissued.
4. Render/validation/task/regression/type/lint checks and meaningful HTTP snapshot/negative checks. Browser verification and scoped local test writes require owner choice for this round.

## Release boundaries

No production migration/deploy, commit/push, account/role changes, legal-clause invention, PDF binary editing, auto-signing or autosave. Template layout flows for long content; physical pagination/print needs independent evidence.

## Verification outcome — 2026-11-09

- Owner authorized local migrations, one synthetic project and HTTP checks, then browser checks without additional saves. ADR0040 implemented across the overview, contract editor/rendering, invoice/receipt preparation and explicit actual-receipt confirmation.
- Applied `20261108183029_contract_paper_terms.sql` and corrective `20261108183514_contract_template_read_lock.sql` to Docker local only. The initial HTTP template call returned 405/25006 because the existing permission helper takes a row share lock in a STABLE/read-only transaction. The correction marks both template functions VOLATILE; all three function bodies were read back equal to source, and volatility was checked.
- `scripts/contract-paper.check.mjs` passed on the same resumed synthetic project BKP-69-134 (`c2b7d6fe-44a3-414f-9556-39cd778e192e`): quotation defaults, explicit edits, omitted/cleared terms, strict negative inputs, replay, unchanged accepted quotation/case customer/price/standard text and anonymous rejection. A failed intermediate test used a missing document-detail version; corrected the test to read the agreement version, then resumed the existing fixture. The script creates a fresh fixture by default; its resume option is for interrupted runs, not an idempotent replay of the completed scenario.
- Contract/payment render and behavior checks, task/layout/schema/quotation/checklist/progress/document-library/design-billing regressions, TypeScript, scoped ESLint and diff whitespace checks passed. Contract default-source sensitivity deliberately broke the selected quotation signer, observed RED, restored GREEN.
- Browser: five selectable stages; one stage's content at a time; unchanged case facts; contract four-section edit/review/back retention; invalid 101% schedule rejected; readonly standard/price; contract and receipt preview at 375px without horizontal overflow. Native invoice date initially displayed a value while validation read empty state; preview now reads submitted FormData date, covered by regression and successful browser recheck. Compact task context now uses the same stage sequence and actual open task label.
- Browser used existing unpaid design invoice in BKP-69-133 and an existing pending synthetic payment in BKP-69-015 for receipt preparation and actual-confirmation preview. BKP-69-133's previously pending bill was already confirmed when read; it was not changed by this browser run. Existing BKP-69-112 tested invoice due date, fixed amount and unissued preview. No final browser save/issue/confirm/upload/sign action invoked; local edits restored/discarded and viewport reset.
- Remaining: native print/PDF pagination, real device/Safari, other-role/cross-case runtime negatives, upload UI and final browser mutations. Four contract sections are logical sheets; long content may span more physical printed pages. No production/account/role/commit/push/deploy changes.
