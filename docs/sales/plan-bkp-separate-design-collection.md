# BKP separate design collection

Decision: ADR0046. Construction-only quotation and contract documents carry a server-issued marker. Signed documents without the marker continue to govern their original balances. Construction-only balances never deduct design receipts.

1. Implement the document pricing basis, post-signature design billing guards and the Overview breakdown.
2. Exercise legacy rejection and the new public RPC sequence in a Docker-local rollback test. A design receipt before contract signing and another after signing both leave the construction schedule unchanged.
3. After local approval, apply only `20261116101237_bkp_separate_design_collection.sql`, verify the function definitions, then run authenticated HTTP for one new synthetic project. Check that the active invoice, receipt and design balance agree with the construction schedule and Overview value.
4. Inspect the new project and the existing signed BKP-69-139 in the browser without submitting. Existing customer and contract data are retained.

Steps 1–3 passed on Docker local. The nine deployed function bodies match migration source. The authenticated HTTP fixture BKP-69-141 signed with THB 2,000,000 in construction instalments and no design credit, then issued, cancelled, reissued and collected a design bill after signature. Legacy BKP-69-139 rejected separate issuance and retained its version. Finance opened in the browser with a THB 5,000 unbilled design instalment and both design receipts visible. The tab was left open for owner testing. Browser form submission, Overview display and native print were outside this handoff check.
