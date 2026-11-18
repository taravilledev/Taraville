# BKP photo contract delivery

Status: Docker local migration, HTTP and browser acceptance passed on 2026-11-09. Production and PDF printing remain unverified.

Confirmed facts:
- Owner supplied a four-part photo reference and accepted both rounds of decisions; see ADR0041.
- Demo renderer gives the page order, but the full approved company clause text is unavailable. The issuer must explicitly approve the actual wording before a real contract can be numbered.
- Prior issued contracts remain unchanged. The addendum shares the existing evidence bucket and amendment numbering, with a separate text-only RPC.

Completed:
- Structured paper fields, inclusive construction end date, separate numbered clauses/conditions/notes, conditional fourth section, blank handwritten payment-date column and the four signature roles.
- New draft preview and legacy renderer compatibility. Approval, required fields, case/document versions and ledger checks remain server-side before numbering.
- Text-only signed addendum preview/print/upload, separate document record with immutable parent, visible in project and library.

Verification and next steps:
1. Render, schema, permission-registry, document library, TypeScript, scoped lint and diff checks.
2. Rollback-only SQL on two existing synthetic cases validates incomplete draft save, real-wording and completeness guards, synthetic lock and linked addendum idempotency with unchanged parent/financial state. Run the migration and `scripts/bkp-photo-contract.rollback.sql` in the same uncommitted local transaction, replacing the migration's final COMMIT with ROLLBACK after assertions.
3. With separate owner approval, apply only `20261109000200_bkp_photo_contract.sql` to Docker local; read back function bodies and verify public HTTP using synthetic fixtures. Browser test editor, sections, return from preview, lock readiness and addendum preview without saving unless specifically authorized.
4. Before actual use, company approves a complete contract text. Native printing and long-content PDF pagination require their own check; the page design is four logical sections, with the last one optional. No production deployment or data cleanup in this scope.

## Local acceptance

Only migration 20261109000200 was applied to Docker local. All eight installed function bodies matched the migration. The authorized HTTP check updated existing synthetic draft BKP-69-134 and added one signed synthetic addendum BKP-A69-0037 to BKP-C69-0084. It verified incomplete-draft lock rejection, required evidence, idempotency, and unchanged original contract, instalments and financial totals.

The browser showed four sections when conditions and notes were present, three when both were cleared temporarily, blank handwritten payment dates, and the missing representative message on the lock screen. The addendum action was initially missing because case detail exposes finance access as can_finance. The task context now maps this to financial.view without changing backend permissions. Browser recheck opened the form from the contract, previewed text and read the issued addendum without saving. Native printing and PDF pagination were not checked.
