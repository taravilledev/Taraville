# BKP reference contract refinement

Decision: ADR0043. Status: Docker-local migration, source readback, synthetic HTTP and no-save browser checks passed on November 13–14. Native PDF/physical pagination and company wording remain pending.

## Confirmed facts — do not re-derive

- Current photo renderer has structured paper fields, but its first section is a summary followed by free text and its schedule has seven columns.
- Full company clauses 3–14 are unavailable in both the reference set and demo placeholder template.
- Existing acceptance uses accepted_at=now(); invoice due dates are currently chosen by the operator.
- Owner chose actual acceptance date plus 30 calendar days for work instalments on new contracts, with deposit/design/legacy unchanged.
- Issued document snapshots and existing ledger/security/version guards must remain intact.

## Work

1. Done: shared preview/issued photo layout and native editable draft fields.
2. Done: optional new-contract payment-condition snapshot, actual acceptance date and backend derived-date enforcement with legacy compatibility. Prepared migration 20261113163034; not persisted.
3. Done: date entry on relevant acceptance tasks and readonly date/basis on invoice preview/edit/issued documents.
4. Passed: render/schema/regression/type/scoped lint and Docker-local rollback-only SQL checks.
5. Done with exact owner approval: applied only migration 20261113163034 to Docker local, read back nine function bodies, ran one synthetic HTTP fixture BKP-69-140 and no-save browser checks on desktop/mobile. Fixed duplicate standalone document header and mobile table overflow found in browser. Native PDF and long-content print pagination remain a separate evidence layer.
