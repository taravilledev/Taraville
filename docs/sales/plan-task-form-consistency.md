# Sales task form consistency

## Scope

Use the quotation editor's focused task identity across quotation, draft contract and related document/payment tasks. Presentation only: no workflow, permission, financial, schema or document-content changes.

## Confirmed facts

- Quotation owns its header; contract currently repeats case, task and editor headings.
- Client editors own dirty/review state and must retain those boundaries.
- `taskReturnTab` already determines permission-aware return destinations.
- `ActionForm.secondaryAction` already supports return-left/submit-right.
- Acceptance retains its full project checklist requested by the owner.
- Two competing stage ordinals exist. Focused headers show category and editing/review phase; project progress remains in the overview.

## Work

1. Share task header presentation, retaining client state and navigation guards.
2. Remove duplicate identity bands for focused paper tasks; align return/review actions.
3. Run render, type and scoped lint checks.
4. Request the owner's browser verification choice under agent-guide section 4.

Status: implementation and render/type/scoped lint checks passed. Owner-authorized no-save browser check passed on desktop1280 and mobile375 for quotation, contract, invoice, receipt preparation and work acceptance. Final signing/locking/confirmation, upload, dirty-navigation dialogs and native print/PDF remain unverified this round. No data writes.
