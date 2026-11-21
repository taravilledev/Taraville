# Plan: whole-app UX redesign (to-be in flow-to-be.md)

Status: the design is complete and the owner confirmed it on 2026-11-20. No code exists yet. Each phase below is a separate branch and PR series into `dev`, stacked after design-system v1 (#23–#27).

- **What to build:** [flow-to-be.md](flow-to-be.md) (per screen) and [design-system.md §8](design-system.md#8-app-wide-interaction-rules-ux-redesign-2026-11-20) (app-wide rules).
- **Why:** ADRs 0057–0063 (git-ignored, main checkout).
- **Mockups:** canvas https://claude.ai/artifact/QVJZM8ptwW7FFRnip19318 version 48. Read the board named in each phase before coding: its `Play` mode shows the interaction, and its `role`, `state` and `variant` tweaks show the states.

## Confirmed facts — do not re-derive

- **Environment.**
  - `.env.local` points at **production**; there is no staging. Staging is deferred: local testing runs on Docker (`supabase start`, then `npm run dev:local`) (owner, 2026-11-20).
  - Never run plain `next dev`. Use `npm run dev:local` (port 3100; `preview_start` config `taraville-local`).
  - Next.js here is newer than model training data, so read `node_modules/next/dist/docs/` before framework code.
- **Tests.**
  - There is no test runner. Checks are `*.check.mts` files run with `node <file>.check.mts`.
  - 13 `src/**/*.check.mts` already fail on `dev` (module resolution). A failing check that does not cover touched files gives no signal; report it as pre-existing.
- **Components.**
  - Installed shadcn components (`src/components/ui/`): badge, button, checkbox, combobox, command, dialog, field, input, label, native-select, popover, radio-group, separator, table, textarea.
  - There is **no sheet or drawer component**. Build the drawer on the existing Radix `dialog`; do not add a dependency.
- **Feedback.** Sonner's `<Toaster>` is already mounted in `src/app/layout.tsx:19` and fed by `?feedback=` (`src/lib/action-feedback.ts`).
- **Stage and next-step code.**
  - `bkpOverviewStage` is in `src/lib/sales/bkp-workflow.ts:14`.
  - `nextStep` and `projectProgress` are in `src/lib/sales/case-progress.ts:17,33`.
- **Other files.**
  - The sidebar menu is in `src/lib/nav.ts`; its labels today are "การเงิน" and "รายงาน".
  - There is no `src/app/global-error.tsx` yet.
- **Swap lists.** Every `window.confirm` and raw `<select>` to replace is listed with its path in [flow-to-be §5](flow-to-be.md#5-backend-and-implementation-notes-facts-for-the-plan-not-decisions).
- **Database.**
  - Tenant and brand isolation lives inside RPCs, so every new plpgsql function filters it itself.
  - `CREATE OR REPLACE FUNCTION` with changed parameters creates an overload: `DROP FUNCTION IF EXISTS <old signature>` first.
  - After applying a migration, dump the function source and diff it against the file.
- **Test accounts.** Executive "Synthetic admin", Sale "Synthetic staff" (0 projects, empty queue). The owner signs in; agents never type passwords.

## How each phase runs

- **Execution.** A phase is executed by a Sonnet subagent with: this plan's path, the phase section, the board names, the file scope, the checks to run, and "no commit/push/migration apply".
- **Review.** The main session reads every `git diff` itself; a report alone is not enough.
- **Stops.** Design forks and R0 stop the executor, which reports back.
- **Verification.**
  - At each phase's verify point, **ask the owner first**: (1) a browser subagent run, (2) a checklist for the owner, or (3) skip. Choices 2 and 3 leave the phase unverified, and the PR is a Draft.
  - Browser checks run on the local Docker stack (`npm run dev:local`), never on prod.
- **PRs.** Commit only when the owner asks. Ask whether the PR is Thai or English. Never mark a PR ready.
- **Logs.** Each session that touches code ends with `.docs/SESSIONLOG-ux-redesign-<topic>-<date>.md`.

## Phase 0 — prerequisites (owner)

- [x] Merge design-system v1 #23 → #27 into `dev`, in order (2026-11-20, `dev` at `e1bf765`).
- [x] Copy ADRs 0056–0063 and the session logs into the main checkout (2026-11-20).
- [x] Staging: deferred. Test on the local Docker stack (`supabase start` + `npm run dev:local`) for now ([flow-to-be §4](flow-to-be.md#4-business-decisions-still-open); owner, 2026-11-20).

## Phase 1 — shared pieces (ADR 0060)

The rules come from design-system.md §8. No screen redesign in this phase, except the swaps. A shared component is built in the first phase that calls it, never ahead of its caller (owner, 2026-11-20).

- [x] **In-app confirm dialog** on `dialog`. Replace the 4 `window.confirm` call sites. Keep the browser `beforeunload` where it exists. (`useConfirm` in `src/components/confirm-dialog.tsx`.)
- [x] **Raw `<select>` → `NativeSelect`** in the 5 listed files (7 selects: `lead-form.tsx` also has the `owner_id` select).
- [x] **Menu labels** in `src/lib/nav.ts`: "การเงิน" → "การเงินบ้านคุณภาพ", "รายงาน" → "รายงาน Lead". Update `nav.check.mts`.
- **Moved to their first caller:** drawer, shared table helpers and the "ยังไม่มีสิทธิ์ทำงานนี้" section → Phase 2; stage track → Phase 3.
- **Verify point:** the swapped confirm and select flows in the browser. Ask first.

## Phase 2 — Lead area (boards Main, LeadsMobile, LeadDetail, LeadEdit, LeadsReport; ADRs 0059, 0061)

- [x] **Shared pieces first called here** (`components/drawer.tsx`, `components/data-table.tsx`, `components/forbidden-notice.tsx`) (moved from Phase 1; rules in design-system §8):
  - **Drawer** (right side ≥768px, bottom sheet <768px) on `components/ui/dialog`: a title, a body that scrolls, and a sticky footer.
  - **Shared table pattern helpers** for `/leads`: sortable header, sticky header, whole-row link, card fallback below 768px. Extract them from what `/sales` and `/summary` already have before adding anything. The money cell (right-aligned, `tabular-nums`, nowrap, 2 decimals) and the dense <1024px variant come with the first money table (Phase 3 "บิลที่ต้องตามเก็บ", Phase 5 `/summary`).
  - **"ยังไม่มีสิทธิ์ทำงานนี้" section** for the Lead-edit non-owner case: it takes what is needed and who grants it (board AuthStates `page=forbidden`).
- [x] **`/leads`.**
  - Stage tabs: ทั้งหมด · ยังไม่เปิดโครงการ · เปิดโครงการแล้ว · ปิด.
  - A sale defaults to "my Leads"; newest first; separate "ขั้น" and "โครงการ" columns.
  - Filter row plus the "ตัวกรอง (n)" panel and removable chips.
  - Remove: the "ซ่อนข้อมูลสมมติ" filter, the "รายงานรายเดือน" header button, and contact columns.
- [x] **Lead detail.**
  - Remove the "ตัวเลือก ▾" menu, `ContactRecord`, "ติดต่อล่าสุด" and the desktop call button.
  - Add drawers: owner (`reassignLead`), survey choice (`recordPrivacy`, verbatim notice strings), evidence history (+ "บันทึกโดย").
  - Add the bottom close and reopen section (`closeLead` / `reopenLead`, reason via `NativeSelect`).
  - Show the BKP retry card with "ลองเปิดโครงการอีกครั้ง".
- [x] **Redirects.** `/leads/[id]/manage` → `/leads/[id]`; `/leads/[id]/history` → `/leads/[id]` with the history drawer open.
- [x] **Cancel project** (executive, active project) moves from `/manage` to the bottom of `/sales/[id]` now, so it never disappears; Phase 4 only lays it out (owner, 2026-11-20).
- [x] **`/leads/[id]/edit`.**
  - Layout: sections, survey chips, `NativeSelect` คำนำหน้า.
  - Sticky "ยกเลิก" / "บันทึก" bar with the in-app unsaved-changes dialog.
  - One phone rule for both brands.
  - A non-owner gets the forbidden section instead of `notFound()`.
  - Fix the stale hint in `lead-form.tsx:52`.
- [x] **`/leads/report`** (Q77–Q83).
  - 3 cards; by-stage + by-brand boxes on the left; by-owner (top 5 + "ดูทั้งหมด") on the right.
  - Sale scope labels; no owner box for sales; the owner filter is hidden for sales.
  - Print dialog: all filtered rows, plus "เลือกเฉพาะบางราย…".
  - The RPC is unchanged; the UI derives "ยังไม่เปิดโครงการ" from `by_stage`.
- **Checks:** report summary derivation (`monthly-report.check.mts`); the phone rule.
- **Verify point:** Lead detail drawers, edit, report print. Ask first. (Done 2026-11-20 as executive at 1280/375; the sale role is not yet verified.)
- **Left from the boards (not built in Phase 2):**
  - `/leads` "โครงการ" column has no project code: `sales_lead_tags` does not return it (RPC change).
  - The mobile filter bottom sheet (LeadsMobile); mobile uses the inline panel.
  - Lead page: grouped survey answers, the "แก้คำตอบ" link and "รู้จักจาก" in the contact card.
  - Stage tracks on project cards and in the report wait for the Phase 3 stage track.

## Phase 3 — homes and the project list (boards SaleHome, ExecutiveHome, SalesList; ADR 0058)

- [ ] **Stage track component** (moved from Phase 1; first called by the sale-home cards and the `/sales` column). A badge with the step number, ✓ or ×, plus 5 segments. Inputs: the brand's stage list, the current index, done / cancelled. Leave a `*.check.mts` covering done / current / cancelled.
- [ ] **Backend migration files, not applied:**
  - `sales_work_queue` + a capability-filtered BKP design-fee kind;
  - `sales_case_list` + the stage and next task (reuse `nextStep()` logic or its SQL equivalent).
  - **Applying either is R0**: show the SQL and wait for the owner's yes, then dump and diff.
- [ ] **Sale home.**
  - 5 cards including "ค่าแบบค้าง" and "Lead ที่ยังไม่เปิดโครงการ".
  - A task-first queue table with row drawers; "โครงการที่ฉันดูแล" cards with the stage track.
- [ ] **Executive home.**
  - h1 "ภาพรวม", no header buttons, brand tabs, 4 cards.
  - 3 follow-up rows, the "บิลที่ต้องตามเก็บ" table, "Lead ล่าสุด", and the amber error notice.
  - No RPC change.
- [ ] **`/sales`.**
  - Columns code·customer · brand · stage track · next task › · owner · updated; stage tabs with counts; "ก่อนทำสัญญา" merge when both brands show.
  - Remove the "ตั้งค่า" header button.
- **Verify point:** both homes with both roles. Ask first; this needs the migrations applied, otherwise say it is untested over HTTP.

## Phase 4 — project workspace, documents, Taraville opening (boards Project*, DesignInvoice, QuotationEditor, ContractEditor, ContractLock, TVProject, TVOpenProject, DocumentView; ADRs 0057, 0058)

- [ ] **Stage tabs and the single "งานถัดไป" card.**
  - The BKP stage comes from `bkpOverviewStage` only.
  - **Tell the owner** that the `/summary` stage tab results change.
  - Redirect old `?tab=` / `?task=` links.
- [ ] **`nextStep()` design-fee branch** (instalment 1 → 2 → 3 → quotation), with a `*.check.mts`. Overdue warns and never gates.
- [ ] **Task tiers.**
  - Full pages: invoice, quotation, contract draft, lock.
  - Drawers: payment record and confirm, acceptance, accept quotation, refunds, reserve, sign, unlock.
- [ ] **Quotation, contract, money, documents** as described in [flow-to-be §3.4](flow-to-be.md#34-bkp-project-workspace-projectdesign-projectmoney-projectagreement-projectdocs-adr-0057). The project close / cancel red bottom section (`cancelProject`, already moved to the bottom of `/sales/[id]` in Phase 2) gets its final layout here.
- [ ] **Taraville `/sales/new`.**
  - Shared table, plus a drawer replacing the native `<dialog>`.
  - The no-units say-why; the redirect stays `?task=reserve`.
- [ ] **`/sales/documents/[id]`.** Top bar and status bar above the paper (not red). The paper content is untouched.
- **Verify point:** one BKP project through every tab, and Taraville open-project. Ask first.

## Phase 5 — `/summary` (board FinanceSummary)

- [ ] **Cards.**
  - 5 KPI cards, plus "รับสุทธิในช่วง" when a period is set.
  - "เกินกำหนด" is a red sub-button inside "ค้างตามบิล".
  - Click-to-filter; icon tiles by meaning.
- [ ] **Filters.** Auto-apply, an owner filter, stage tabs, the period merged in with presets, the closeout chip only when above 0, no synthetic toggle.
- [ ] **Table.** 4 money columns, no horizontal scroll; table ≥1024px, cards below.
- [ ] **Export.** CSV and print all filtered rows via `/summary/export` and `?print=1`. The selection is optional, with a reason text instead of a disabled button and a toast on download.
- **Verify point:** money totals against the current page on the same filters. Ask first.

## Phase 6 — settings (boards SettingsCatalog, SettingsPermissions, SettingsIssuer; ADR 0062)

- [ ] **One "ตั้งค่า" page with 3 tabs.** The catalog uses the shared table and drawers, with say-why notes.
- [ ] **Permissions.** A staff table → a per-person matrix of the 17 capabilities, with a sticky save and a diff confirm. **Read the sale defaults from SQL** instead of the hand-mirrored list in `permissions/page.tsx:53-56`.
- [ ] **Issuer.**
  - A company drawer.
  - A contract-text section with the status and "last saved by/at".
  - A full-page editor with the two explicit saves; consequence warnings.
  - **Remove the test-mode UI.**
- [ ] **Migration file: issuer `is_synthetic` default → `false`.** Applying it is R0.
- [ ] **Blocker labels.** Deep-link labels name the real action ("ไปตั้งค่าบริษัทผู้ออกเอกสาร").
- **Verify point:** permissions save + diff confirm, using a test account only. Ask first.

## Phase 7 — login, account, errors (boards AuthLogin, AuthPassword, AuthStates)

- [ ] **Login.**
  - Show/hide password, the username rule, a spinner.
  - Distinct login errors: **verify first which codes Supabase auth returns**, and keep one generic message where they are not distinct.
- [ ] **Session return.** `?next=` in `requireStaff` with same-origin validation, plus a `*.check.mts`. "หมดเวลาการใช้งาน…" banner. A signed-in user on `/login` → `/dashboard`.
- [ ] **Forgot-password page** "ติดต่อ Support ทาง LINE", LINE ID `art` (owner, 2026-11-20).
- [ ] **Change password.** Live checklist and the "signs out every device" note. Sidebar user block: "เปลี่ยนรหัสผ่าน" / "ออกจากระบบ" (not red, no confirm).
- [ ] **Error pages.**
  - The error page gets retry, home, and a reference code; add `src/app/global-error.tsx`.
  - Not-found buttons depend on sign-in.
  - `/privacy` without a brand asks for it.
- **Verify point:** login error states and session return. Ask first.

## Phase 8 — walk-in (board WalkinForm; ADR 0063) — **last**

- **PDPA review: done** (owner, 2026-11-20). The attestation wording, the survey shown before consent, and the combined checkbox stand as drawn.
- [ ] Three steps with no notice step; consent text on step ②; chips; the advance warning on ③; the saved screen without personal data; the executive-without-sale-account block; the in-app leave dialog; one phone rule.

## R0 tasks (never inside a phase; each needs its own approval with the exact list)

- **Apply the Phase 3 and Phase 6 migrations to prod**, then dump and diff.
- **Go-live purge** (ADR 0062):
  - delete synthetic rows (count them per table first and show the list);
  - set every issuer's `is_synthetic = false`;
  - then decide on the flag, test modes and "Synthetic" accounts.
