# Focused BKP project page sections

Status: implemented and browser-checked locally, 2026-11-09. Owner approved the four-section proposal.

## Outcome

Place navigation directly below project identity: overview, design fees, documents, receive money (pending count). Full workflow/checklist and house requirements belong to overview. Design packages/bills belong to the design tab. Documents retain the existing library. Money starts with pending confirmations; passive totals/receipts/refunds are native disclosures, with actionable refunds expanded.

## Scope

Reuse existing permission checks, structured data, native links/disclosures and task views. No financial rule, database or migration change. Taraville retains its three-section navigation and current flow. Update internal design links/save redirects and return-to-section task links. An overview quick link retains the old design-fees anchor for old bookmarked overview URLs.

## Verification

- case-layout.check.mts covers header navigation order and workflow suppression, pending-first money, passive-history collapse, retained receipt links and overview isolation.
- TypeScript, scoped ESLint, task/design-billing/case-progress/document-library/layout checks and diff checks passed.
- Read-only browser on existing case b7819444-1454-4f80-a21a-db380fdb2099: all four tabs, history/summary disclosure, design task return link, overview workflow/house details, selected navigation and375px overflow checks. No submit/upload/data creation; viewport reset.

## Limits and separate finding

No production/physical-device/native-print or other-role browser verification. The document library currently labels some invoice cards as unpriced although opening the saved invoice shows its amount; observed separately and left unchanged because it is outside this layout change. No commit/push/deploy.
