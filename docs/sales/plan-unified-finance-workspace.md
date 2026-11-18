# Unified BKP finance workspace

Owner decisions: ADR0045. Existing tab URLs and business transaction contracts remain stable.

## Confirmed facts

- Global received already includes design receipts minus paid refunds. Design credit is reuse of those receipts, not new revenue.
- Design bills have pending IDs; contract pending payments do not expose invoice IDs in the current read model.
- `design-billing` redirect previously served both package saves and bill operations; these destinations must split.
- Existing `taskReturnTab`, versioned task forms, ActionForm and document viewer are reused.

## Work

1. Compact finance collection row projection and responsive filtered table/mobile rows, grouped by design/contract.
2. Combined pending queue and separate financial summary values; retain legacy/adjustment/credit/closeout safeguards and histories.
3. Design package-only summary; move tab counts, action returns, redirects and emitted shortcuts to finance. Preserve old design-hash links via a visible bridge.
4. Regression render/model/navigation/action checks, independent source review, TypeScript/lint; owner chooses browser verification for the complete pass.

Status: implementation, independent source review, regression/type/lint checks and owner-authorized no-save browser acceptance passed for the existing fixtures described in `.docs/SESSIONLOG-unified-finance-browser-2026-11-14.md`. Final mutation redirects, new bill creation, physical devices and native PDF remain unverified this round. No database migration or data writes.

Corrections from source rereview: actual withdrawal task now binds the same fixed finance return hint as other BKP financial tasks; tests exercise task → bound action → mock RPC → redirect. Cancelled projects use only closeout remaining as current receivable; old design/instalment rows are clearly references, including empty-state wording. Missing closeout does not fall back to old balances. Action tap targets remain at least44px.
