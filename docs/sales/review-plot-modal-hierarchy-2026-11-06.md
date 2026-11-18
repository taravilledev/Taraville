# Plot confirmation modal hierarchy review — 2026-11-06

The review covers the Taraville opening form's plot confirmation dialog. The ux-reviewer inspected the current source and two screenshots of synthetic plot B3 at 1508×853 and 375×853. The parent verified that the current local modal matches the captures. These are visual hierarchy judgments grounded in the observed layout. The mobile capture shows the action within the viewport.

| Priority | Observed layout | Proposed change |
| --- | --- | --- |
| 1 | The amount is visually prominent at 24px. The table labels it “ราคาทะเบียน”, but the dialog shows the amount on its own. | Put “ราคาทะเบียน” directly above the amount. Staff can identify which price they are reviewing. |
| 2 | The muted draft explanation sits directly after the last property fact, with a separate gap before the green action. On mobile the note starts around y637 and the action around y720. | Group the existing draft and reservation explanation with the primary button. Place the explanation immediately before the action and give it its own visual boundary from the facts. |
| 3 | The plot code and Project name are separate 13px elements. The address leads the six equally weighted facts, which stack into six rows on mobile. The sample includes two unknown values. | Group the plot code and Project name in the header. Show model, land area, usable area and construction status first. Place address and layout after these facts with lower visual emphasis. |

Recommended order from top to bottom:

1. Plot code and Project name together, with Close alongside the header.
2. Catalog price label and amount.
3. Model, land area, usable area and construction status.
4. Address and layout as secondary facts.
5. Draft consequence and the existing primary action in one group.

Source anchors are `src/app/sales/new/opening-fields.tsx:54–68`, `src/app/sales/sales.module.css:86–87`, and `src/app/walkin/walkin.module.css:137–141`. Evidence images are `/private/tmp/taraville-plot-modal.jpg` and `/private/tmp/taraville-plot-modal-mobile.jpg`.

Review only. No form submission was performed for this review. The captures cover one plot and two viewport sizes. Long populated fact values, real mobile hardware, and assistive technology were outside this visual check.
