# BKP workspace consistency pass

Approved hierarchy: heading/status and important facts → current actions → active details → history. See ADR0044.

## Confirmed facts

- Design billing and latest quotation already expose state/action/history; contract and instalment lists remain sparse paragraphs.
- Task registry determines permitted actions. Draft lock availability does not prove required fields or company text are ready.
- Pending design receipts and actual receipts are distinct; no new fee gate before quotation.
- Native editable paper, preview, upload and dirty-state guards must remain intact.
- Taraville behavior and production are outside this BKP presentation pass.

## Implementation

1. Shared workspace heading/spacing/facts/status/action patterns; consistent document-library entry point.
2. Contract current snapshot and state-specific actions plus history; preserve live references and cancelled labels.
3. Instalment cards with acceptance/bill/collection state, dates and permission-safe next actions; pending/refunds visible.
4. Overview/design/quotation/library and remaining BKP task forms aligned to the same hierarchy.
5. Render representative states and permissions, run type/scoped lint, reviewer source audit; request browser choice for the complete pass.

Status: implemented and independently source-reviewed. Nine relevant render/model/task checks, TypeScript, sales ESLint and diff checks passed. Browser acceptance pending owner's round-specific choice.

Source rereview corrections: zero-net instalments require the existing active-invoice completion predicate before displaying paid; credit-covered unbilled rows explicitly await a credit summary. Noncancelled signed/awaiting contracts remain visible in both contract and document-library views alongside newer drafts. No migration or data writes.
