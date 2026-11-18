# Inline quotation sheet

Status: implemented locally; render/type/lint checks and no-save desktop/mobile browser checks passed, 2026-11-08.

## Approved outcome

Owner asked to try editing the quotation directly in a PDF-like document layout. Use a responsive HTML A4 sheet backed by existing structured quotation data, not arbitrary binary-PDF editing. Keep validation, independent revisions, readonly issued snapshots and confirmation before issuing.

## Confirmed facts

- Existing QuotationEditor owns editable state, dirty guard, validation, review and issueQuotation action. Preserve these paths.
- Paper snapshot, price/spec/exclusions and existing optional fields already save through the current RPC. This change needs no migration or API change.
- QuotationContent renders issued house/price/materials/conditions/footnote/signatures and has no server dependency. Reuse it for readonly preview.
- Company identity is configured separately and snapshotted when issuing. The unissued sheet uses BKP branding rather than guessing current legal issuer settings. It is explicitly labelled a preview, not an issued or numbered document.

## Scope and steps

1. Replace the stacked questionnaire appearance with a paper canvas and native labelled inline fields. Completed.
2. Arrange material rows as columns on desktop and stacked labelled rows on mobile. Preserve add/remove/max counts and errors. Completed.
3. Render readonly sheet preview from current state before the existing save-new-revision action. Completed.
4. Compact workflow context on the quotation task and keep the house brief in its existing other views. Completed.
5. Render assertions, sensitivity, type/lint and browser interactions. Static checks passed. Browser checks passed at 1280px and 375px without saving: price/proposer edits, add/remove material and condition rows, preview/edit retention, required-name validation/focus and estimate mode. Viewport reset and all test edits restored.

## Limits

No drag positioning, freeform rich text, PDF import, autosave or PDF generator. The sheet flows with its content; it does not guarantee a fixed page count. Native print/PDF and real devices need separate evidence. Existing native unsaved-confirm behavior is retained and has known browser-tool verification limits.
