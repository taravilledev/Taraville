# Proposed technical contract — Sales-to-receipt dev implementation

Status: Owner accepted the two structural choices on 2026-11-02 in [ADR0029](../adr/0029-isolated-sales-cases-and-integer-satang.md). Detailed schema/RPC/capability mapping remains in progress. Dev implementation is authorized; production is not.

## Verified dev environment

- Implementation branch: `codex/sales-receipt-dev`, preserving unrelated untracked files.
- Initialized repository Supabase local config and started Docker Desktop/local Supabase. Existing repository migrations applied locally; API `127.0.0.1:54321`, Postgres `127.0.0.1:54322`. No production migration or write.
- Existing `.env.local` still points at the production project. `npm run dev:local` reads current local Supabase status, accepts only a loopback HTTP API and local publishable key, and overrides the two Next public variables in the child process. It fails closed if the local stack is unavailable. Production credentials are not copied into fixtures.

## Choice A — Shared financial case, isolated from shared Lead/Project reads (recommended)

Add a financial/sales case identity referencing the existing BKP Project for BKP, or the selected registered unit for a Taraville sale. Preserve existing Lead IDs, BKP Project codes and read behavior. Store new negotiated terms, documents and money separately rather than appending them to broadly shared Lead survey/Project rows.

Alternative: widen the existing `projects` table to both brands and place finance there. This saves one identity relationship but changes its BKP-only meaning, Lead-dependent read/cancel behavior and later Stock boundary. It requires a larger compatibility/access migration.

Proposed groups (names are proposed, not claims of existing tables):

| Group | Records and invariants |
|---|---|
| Permissions | Current active actor; explicit action and own/all scope grants; Executive-only grants/reassignment; own means Lead Owner for finance, responsible user for case operations. Owner financial visibility is a revocable starting preset, never a permanent bypass |
| Customer/catalog | Brand-scoped Customers; Housing Developments and unique named units within a development; explicit customer linking, no phone uniqueness/merge |
| Case | Stable identity/brand/Lead/customer/responsible user; unique existing BKP Project association; one unit per Taraville sale; version, audit history, no automatic ownership propagation |
| Reservation | Case/unit confirmation/release history and unique active unit commitment; no expiry fields or scheduler; atomic unit change |
| Agreement | Design plan, quotation revisions/accepted revision, draft/signed contracts and evidenced amendments/close-out; saved/issued snapshots |
| Billing | Ordered instalments, agreed design-credit applications, invoices with gross/credit/net; no-money settlement for zero due while preserving work acceptance |
| Actual money | Positive confirmed payments and allocations, issued receipt snapshots/unique numbers, refunds with separate approval/payout, linked authorized adjustments; document cancellation does not manufacture a refund or erase actual funds |
| Evidence/audit | Private files with current-capability checks, immutable issuance/correction history and replay records; no public proof URLs |

No raw financial-table access for ordinary authenticated clients. Follow the repo's authenticated query/mutation RPC pattern with fresh actor/grant checks, explicit brand and case scope, controlled schema privileges and safe errors. Add concrete read/write capability checks at every RPC, including print/proof retrieval. Catalog access cannot expose a customer's negotiated terms.

## Choice B — Money in integer satang (recommended)

Persist money as Postgres `bigint` satang. Parse decimal THB strings exactly, reject negative/extra-precision amounts, use integer/BigInt arithmetic for percentages and credit allocation, and serialize money explicitly as strings across the RPC/JSON boundary. Keep display amounts in THB. No unchecked floating-point arithmetic, no money dependency and no raw BigInt JSON.

Alternative: `numeric(...,2)` THB with string transport and exact decimal calculations. Also valid, but needs equally careful handling to stop API decimal values becoming floating-point arithmetic in JavaScript. Stock's separate valuation/rounding policy is not decided by this sales choice.

## Mutation and privacy contract to finish before SQL

- Dedicated RPCs per operation, with request ID, current expected version, replay payload match and actor/scope validation. No generic arbitrary SQL/operation endpoint.
- Lock the case/invoice/unit in a documented order; enforce single active unit commitment, positive confirmed receipt amount, allocation not above outstanding and refund commitments/payouts not above unrefunded money under concurrency.
- Confirm payment plus issue receipt/number/snapshot atomically and require both capabilities. Direct BKP design payments and Taraville booking payments need no invoice; later invoice allocations cannot count the original funds again.
- Refund requestor cannot approve their own request; approval is not payout. Specify correction/replacement versus actual money reversal and their allocation/credit effects explicitly before creating those RPCs.
- Block ordinary Lead removal for issued documents or active unit commitments. Never cascade-release a unit or detach the Lead link used for owner-default finance access.
- Drafts are editable; signed/issued snapshots use the agreed amendment/correction route. A zero-net instalment has no new payment/receipt/income and no cash reminder; work acceptance remains independent.
- Read minimal customer/case identity for an authorized financial action; financial access is not blanket access to Lead surveys. Keep shared Lead reading independently authorized.

## Implementation and verification sequence

1. Confirm structural choices, map exact tables/RPCs/capability defaults and independently review migration/transition contract. No production backfill is inferred.
2. Implement local permission/customer/case/catalog foundation with synthetic local accounts and boundary tests.
3. Complete BKP agreement/billing/payment/refund/print flow, including pre-contract design receipts, partial payment and credit-only settlement.
4. Complete Taraville units/manual reservation/sales/booking receipt/agreement/billing/refund/print flow on the same money foundation.
5. Exercise real authenticated local HTTP races, revocation, allocations, refunds, snapshots and both full loops; then obtain the owner's browser-verification choice and test actual saved-data/PDF flows.

Approved real company contract wording remains an input before issuing usable company contracts. Dev-only synthetic fixtures must be labeled and must not be presented as approved wording. Do not replace the full agreed loop with a mock or a summary-only screen to claim completion. Stock connection follows the completed sales loops and is outside their implementation milestone.

## Execution evidence so far

- Structural choices accepted; local Supabase startup and existing migrations succeeded. The local dev runner is live on port3100; anonymous `/login` returned HTTP200 HTML and did not contain the production project hostname. This is not authenticated/UI acceptance.
- Local-runner boundary checks passed after a sensitivity RED with the guard disabled (`Missing expected exception` for a remote URL), then restored GREEN.
- Added `src/lib/sales/money.ts`: exact decimal-input parsing, bigint-satang strings, formatting, promotion-zero handling and gross/credit/net instalment allocation. Percentage fractions truncate before final remainder allocation; tiny-cent plans cannot produce a negative final row.
- Money checks passed after sensitivity RED by deliberately reversing credit direction: final net was1,800,000 satang instead of0. Restored last-to-first allocation and GREEN; includes the100,000/25,000 credit example, full credit, excessive credit, invalid percentages, invalid precision and overflow.
- Typecheck and targeted lint passed for that initial money foundation. Current shared-foundation implementation is recorded below; neither brand's full receipt loop is complete. Goal remains active; do not equate a foundation milestone with completion.

Shared-foundation follow-up (local only): initial four sales migrations implement private capabilities/customer/catalog/case/replay infrastructure and authenticated case/bootstrap/admin/catalog RPCs. `/sales` pages and real server actions support opening, viewing, editing and assigning a case, setting financial capabilities, and maintaining developments/units. `scripts/sales-foundation.check.mts` passes real local Auth/HTTP, SSR and Next Server Action tests. See `.docs/SESSIONLOG-sales-foundation-2026-11-03.md` for its initial sensitivity and scope limits.

Financial follow-up (local only, 2026-11-03): fourteen total sales migrations now include actual-money/document/receipt/refund tables, private proof storage, issuer configuration, design plans, explicit accepted quotation and signed contracts, integer schedule/credit allocation, acceptance-gated invoices/zero-cash settlement, partial receipts and independently approved actual refunds. Dedicated checked RPCs and UI/print pages exist for these slices; no generic operation endpoint or client financial-table grant. `scripts/sales-money.check.mts` passes actual Auth/HTTP/Next Action/SSR/Storage checks. A real failing confirmation exposed a void-return actor lookup; additive actor-fix migration restored GREEN. Readback matches70 current function bodies, private-table and anonymous-execute exposure0. Amendments/close-out/corrections, full Taraville reservation/sale flow, operational-only acceptance UI, legacy lifecycle guards and final acceptance remain unfinished. Browser/PDF acceptance and approved real company contract wording remain pending; synthetic fixtures are labeled.
