# Project and plot picker UX review — 2026-11-06

Status: read-only review complete; no application changes or data mutations.

## Scope and evidence

Reviewed `/sales/new?lead=b16c9ad4-9c84-4f98-bd71-3d0719b01a0f` on localhost against accepted ADR0032. Parent supplied live browser observations; the ux-reviewer inspected `opening-fields.tsx`, `search-picker.tsx`, `new-case-form.tsx`, and `sales.module.css`. Applied the ux-audit workflow, installed UX Pro Max keyboard guidance, and the previously retrieved Web Interface Guidelines. No accessibility-conformance claim or numeric UX score.

Browser evidence supplied by parent: desktop 897×853 and mobile viewport 375×853, authenticated local synthetic context. No form submitted and no records created or changed. Mobile document width was 375px with no horizontal overflow. Desktop evidence: `/private/tmp/taraville-ux-review-project-plot.jpg`. Viewport emulation is not real-device testing.

## Proposals awaiting decision

### UX01 — Dropdown toggle opens a list without keyboard navigation

Classification: observed defect. Priority: P2.

Reproduction: focus the plot dropdown toggle, open it, then press ArrowDown. Parent observed focus remaining on the toggle, 48 options displayed, and no active option. Source: `src/app/sales/new/search-picker.tsx:38–50`; navigation handling exists only on the input.

Consequence: the visible dropdown control does not provide the same keyboard interaction as its adjacent search input. Users must discover that they need to move focus back to that input.

Smallest correction: when the toggle opens the popup, move focus to the combobox input, where the existing Arrow/Enter/Escape handlers operate. Preserve the existing toggle-close behavior. Verify input-focus opening, button-focus opening, Arrow navigation, Enter selection, Escape dismissal, and Tab exit.

### UX02 — Clearing a Project loses keyboard focus

Classification: observed defect. Priority: P2.

Reproduction: choose a Project, then activate its clear button. Parent observed the button disappearing and `document.activeElement` becoming BODY. Source: `src/app/sales/new/search-picker.tsx:25–26,48`; clearing unmounts the focused button without restoring focus.

Consequence: keyboard users lose their place while resetting a filter, even though the selected plot correctly remains intact under ADR0032.

Smallest correction: return focus to the associated combobox input when clearing. Keep the selected plot and full eligible plot list exactly as specified. Verify both Project and plot clear buttons and subsequent keyboard navigation.

### UX03 — Optional Project filter can retain an invisible-to-submit error

Classification: observed state plus heuristic concern. Priority: P2.

Evidence: after a valid plot selection, parent typed an unmatched Project query and tabbed away. The previous plot summary remained, but the Project input became invalid with the choose-or-clear custom validity message. No inline error appeared in this state. Source: `search-picker.tsx:23,35–37`; `opening-fields.tsx:17–21`. No submit was attempted, so native submit-time validation appearance is unverified.

Consequence: the form looks ready because a valid plot is still selected, while text in the optional filter now blocks submission. The plain Project label does not explain that it is optional or that typed text must be selected or cleared.

Smallest correction proposal: label the field as an optional filter and show adjacent choose-or-clear feedback when an unmatched query is left on blur. Preserve explicit option selection and current filtering semantics. Automatically discarding queries or accepting arbitrary text would be a separate behavior decision.

### UX04 — Selected-detail density pushes the action down

Classification: heuristic concern. Priority: P3; optional polish.

Evidence: at 375×853 the selected summary presents eight similarly weighted fields, including unknown values; parent measured submit top at approximately 1029px. Source: `opening-fields.tsx:30–35`; existing responsive stacking is functioning and no overflow was observed.

Consequence: staff must scan unavailable secondary details and scroll before opening a draft. Being below the fold is not itself a defect or standards failure.

Optional correction proposal: keep plot, Project, and price prominent; place secondary property details behind an explicit expansion. This changes information hierarchy and needs an owner choice. Do not add a wizard or extra confirmation.

## Settled behavior preserved

Source matches ADR0032: Project is optional; plots are initially all active available units under active developments; plot-first fills its parent; selecting an incompatible Project clears the plot; clearing Project preserves the plot; option context disambiguates duplicate plot codes; selection uses UUIDs. Customer data comes from the originating Lead, without a reuse control. Selected property details, draft/no-reservation wording, backend availability checks, and BKP explicit Project binding remain in scope to preserve.

No recommendation to restore mandatory Project-first selection, customer-reuse controls, or a large Lead section. Their earlier proposals were superseded by owner decisions.

## Verification limits and next action

No fixes were made in this review. Submit, native submit-time error display, loading, success, concurrent availability changes, screen-reader behavior, real mobile hardware, and other roles were not exercised in this audit. Parent browser observations establish the listed interactions only; source inspection does not establish whole-page accessibility compliance.

Recommended next action: fix UX01 and UX02 as bounded focus corrections, and agree on UX03's filter/error clarification before changing wording or behavior. UX04 can remain deferred.

## Authorized follow-up — 2026-11-06

Owner authorized fixes and integrated clear/chevron controls. UX01/UX02 focus fixes, UX03 inline choose-or-clear feedback and UX04 compact/expandable summary implemented and browser-checked; optional-filter helper was explicitly removed at owner request. Equal16px SVG icon alignment measured. See `.docs/SESSIONLOG-picker-focus-inline-controls-2026-11-06.md` for exact checks and limits. No submit/data mutation.
