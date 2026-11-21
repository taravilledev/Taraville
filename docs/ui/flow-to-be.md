# UX redesign — flows to-be

Status: every screen below was decided by the owner in grilling rounds Q1–Q92 on 2026-11-20. The owner confirmed that the design tree is complete. Nothing here is implemented yet; delivery is in [plan-redesign-ux](plan-redesign-ux.md).

- **Mockups (source of truth for layout):** the private canvas "Taraville Leads redesign", version 48 — https://claude.ai/artifact/QVJZM8ptwW7FFRnip19318. Every board is interactive (Play) and most have a `role` tweak (sale / executive). The board names are given in brackets below.
- **As-is behaviour:** `docs/ui/flow-as-is.md` (main checkout).
- **Built on:** [design-system v1](design-system.md) (ADR 0056, PRs #23–#27). The redesign keeps v1's tokens, status groups, brand tag, typeface, sidebar and stage names. The new app-wide rules are in design-system.md §8.
- **ADRs (git-ignored, main checkout):** 0057 project workspace, 0058 design-fee next step, 0059 contact recording removed, 0060 UI interaction rules, 0061 Lead page without sub-pages, 0062 synthetic data and test mode, 0063 walk-in steps and consent placement. The PDPA review behind ADR 0063 is done (owner, 2026-11-20; [§4](#4-business-decisions-still-open)).

## 1. Ground rules (Q1–Q7)

- Redesign the UI on the **existing business rules**. A rule conflict found on the way goes to §4; it is not changed silently.
- Scope is the whole web app: Leads, projects, sales, settings, walk-in, login, account, finance, report.
- Desktop first; iPad fully usable; phone = view plus short tasks (record or confirm money, accept, sign).
- Old `?tab=` / `?task=` URLs and removed pages redirect to their new place (§6).

## 2. Screen inventory

| Route | Board(s) | Page type | Decisions |
|---|---|---|---|
| `/login`, `/login/help` | AuthLogin | full page | Q59–Q63 |
| `/account/password` | AuthPassword | full page | Q64–Q65 |
| error, not-found, forbidden, `/privacy` | AuthStates | full page | Q66–Q67, Q74 |
| `/dashboard` (sale) | SaleHome | home | Q33–Q38 |
| `/dashboard` (executive) | ExecutiveHome | home | Q89 |
| `/walkin` | WalkinForm | focus mode, no sidebar | Q48–Q57, Q84 |
| `/leads` | Main, LeadsMobile | work list | Q11, Q16–Q21 |
| `/leads/[id]` | LeadDetail | detail + drawers | Q13, Q85, Q88 |
| `/leads/[id]/edit` | LeadEdit | full-page form | Q86–Q87 |
| `/leads/[id]/manage`, `/history` | — (removed) | redirect | Q85, Q88 |
| `/leads/report` | LeadsReport | report + print dialog | Q77–Q83 |
| `/sales` | SalesList | work list | Q33–Q35 |
| `/sales/new` (Taraville) | TVOpenProject | full page + drawer | Q90 |
| `/sales/[id]` BKP | ProjectDesign · ProjectMoney · ProjectAgreement · ProjectDocs | stage-tab workspace | Q23–Q31 |
| BKP paper tasks | DesignInvoice · QuotationEditor · ContractEditor · ContractLock | full page | Q24, Q26′, Q28–Q30 |
| `/sales/[id]` Taraville | TVProject | stage-tab workspace | Q23 |
| `/sales/documents/[id]` | DocumentView | bare paper page | Q91 |
| `/summary` | FinanceSummary | report + export dialog | Q68–Q76 |
| `/sales/settings/*` | SettingsCatalog · SettingsPermissions · SettingsIssuer | one page, 3 tabs | Q39–Q47, Q92 |

## 3. Flows

### 3.1 Walk-in → Lead (WalkinForm)

1. The brand picker stays as the entry.
2. Steps ① ข้อมูลติดต่อ ② แบบสอบถาม ③ ตรวจและบันทึก. There is no notice step (owner); "อ่านประกาศ" stays in the header and on step ③.
3. The survey is visible from the start. The exact `choices.survey_consent` text sits on top of step ②, and answers are saved only with consent (the RPC already enforces it). Step ③ warns in advance about anything that blocks saving.
4. Survey options are big chips in three groups, with no numbering. The survey "พนักงานขาย" answer becomes the chosen owner (data-meaning change, §4).
5. Phone validation is the same for both brands (bug fix). Field errors show inline.
6. After saving: "บันทึกแล้ว · คุณ{ชื่อ}" with no other personal data, plus "รับลูกค้ารายถัดไป".
7. An executive with no sale account is blocked up front, with the reason.
8. Leaving with unsaved values uses an in-app dialog. The browser's own `beforeunload` prompt stays for tab close and reload.
9. Legal and consent strings stay word for word (`docs/walkin/notices/walkin-live-2026-10-30.1.json`, `choices.*`).

**Walk-in ships last.** The PDPA review is done (owner, 2026-11-20; Q84, §4).

### 3.2 Lead list → Lead (Main, LeadDetail, LeadEdit)

- **`/leads`** is a work list.
  - Stage tabs: ทั้งหมด · ยังไม่เปิดโครงการ · เปิดโครงการแล้ว · ปิด. A sale defaults to "my Leads". Newest registration first. "ขั้น" and "โครงการ" are separate columns.
  - Filters: brand · search · owner, plus "ตัวกรอง (n)". The panel holds registration range, BKP budget or Taraville monthly instalment, and source channel. Survey filters need a brand. Taraville location is searched, not filtered. Active filters show as removable chips.
  - There is no "ซ่อนข้อมูลสมมติ" filter (Q76, answer 1).
  - The header holds page actions only (ส่งออก CSV for executives, รับลูกค้า). The "รายงานรายเดือน" button goes, because the sidebar has it.
- **Lead detail** is one page; there are no sub-pages and no "ตัวเลือก ▾" menu (ADR 0061).
  - The primary action depends on the stage. There is none when the Lead has two or more active projects.
  - Several projects show as cards; finished ones are folded.
  - "ความต้องการของลูกค้า" shows the real BKP `SURVEY_QUESTIONS`. On top of it sit the survey-choice status line and "เปลี่ยนตัวเลือก…", which opens a drawer:
    - Opt in: the verbatim notice and the two checkboxes.
    - Withdraw: it wipes the answers, including the address, and cannot be undone, so the button is red and says what is deleted.
  - The owner has a pencil (executive) that opens a drawer: a `NativeSelect` of active sales, with the hint "ผู้ดูแลคนใหม่จะแก้ไขรายการนี้ได้ ผู้ดูแลเดิมยังดูข้อมูลได้".
  - Evidence history is a row link in the contact card. It opens a drawer with the same fields as today plus "บันทึกโดย {ชื่อ}" (`actor_id` is already loaded). Any staff member may open it, as today.
  - Close Lead is a bottom section. It is not red, because closing is reversible. It opens a reason dialog using `NativeSelect` and warns about blockers in advance; an active project blocks closing (ADR 0008).
  - A closed Lead shows a grey band (reason · by · date) and "เปิด Lead อีกครั้ง". Reopening needs no confirm dialog, because it is reversible.
  - No call button on desktop. No contact recording (ADR 0059).
- **Edit (`/edit`)** stays a full page (LeadEdit).
  - Layout: the contact section, then the survey as chips, on one page with no steps. "คำนำหน้า" uses `NativeSelect`.
  - The sticky bar has "ยกเลิก" (new) and "บันทึก". Unsaved changes trigger the in-app dialog. Phone validation matches walk-in.
  - Without survey consent, the survey card links to the Lead's survey-choice drawer. This fixes today's hint, which points at the wrong page.
  - A sale who is not the owner and opens the URL directly sees "ยังไม่มีสิทธิ์ทำงานนี้" with the owner's name and "ขอให้ผู้บริหารเปลี่ยนผู้ดูแล" (Q87). Today they get a 404.

### 3.3 Opening a project

- **BKP.**
  - "เปิดโครงการ" on the Lead opens the existing `OpenProjectDialog`. On success the project opens on ออกแบบ with the package drawer open.
  - If it fails halfway (a project exists but no case), the Lead shows a retry card with a "ลองเปิดโครงการอีกครั้ง" button. There is no separate page.
- **Taraville** opens `/sales/new` (TVOpenProject): "เปิดโครงการ · เลือกแปลง".
  - The table follows the shared pattern: search, a development filter, and "N จาก M แปลงว่าง".
  - A row opens a drawer with the unit facts ("ยังไม่ระบุ" where missing), the note "เปิดเป็นร่าง ยังไม่จองหรือกันแปลง", and "เปิดโครงการด้วยแปลงนี้". The success redirect goes to the จองแปลง stage.
  - With no free unit it says why. Users with catalog rights get a link to the catalog; others are told whom to ask.

### 3.4 BKP project workspace (ProjectDesign, ProjectMoney, ProjectAgreement, ProjectDocs; ADR 0057)

- **Frame.**
  - A stage bar of tabs: เปิดโครงการ · ออกแบบ · ใบเสนอราคา · สัญญา · รับชำระ · เอกสาร.
  - Exactly one "งานถัดไป" card.
  - The stage comes from one source: `bkpOverviewStage`. This changes `/summary` stage filtering (§5).
- **Task tiers.**
  - Paper and editor tasks are full pages: design invoice, quotation, contract draft, contract lock.
  - Short forms open in a right drawer, or a bottom sheet on mobile: record or confirm payment, acceptance, accept quotation, refunds, reserve, sign, unlock.
- **ออกแบบ.**
  - The package drawer is first.
  - The design fee has no deposit and three instalments billed on delivery (แบบแปลน / 3D / ครบทุกรายการ). The amounts are in `src/lib/sales/design-fees.ts`; the labels are in `src/app/sales/[id]/tasks/design-billing-tasks.tsx`.
  - During design the next step is the next instalment: "ส่งมอบ<x>แล้ว → ออกใบแจ้งชำระงวด n" (ADR 0058).
  - Unpaid fees show as "ค่าแบบค้าง". Overdue fees show a warning that does not block anything (ADR 0039: no gates).
- **ใบเสนอราคา.**
  - The latest quotation is a card, with an accept drawer and the history folded below.
  - The priced quotation becomes the main line after design instalment 3. Quotations are construction only (ADR 0046).
- **สัญญา.**
  - Four sub-steps. Blockers are warned in advance.
  - Draft → lock is a full page with a readiness checklist and a preview.
  - Sign and unlock are drawers. Amendments live here.
- **รับชำระ.** Instalments and payments; refunds live here.
- **เอกสาร.** A list with a preview modal, which opens the document page (§3.10).
- **Assign and close.** Assigning is a pencil. Closing or cancelling the project is a red bottom section, because it is irreversible. It moved here from `/leads/[id]/manage` (Q85).
- **Mobile.** Stage chips scroll sideways, forms use bottom sheets, and paper is view-only.

### 3.5 Taraville project (TVProject)

The same frame with Taraville's own stages (เปิดโครงการ · จองแปลง · สรุปการจอง · สัญญา · รับชำระ). It keeps `projectProgress` as its stage source (TypeScript only).

### 3.6 Homes and the project list

- **Sale home (SaleHome).**
  - Five cards: เงินเข้ารอยืนยัน · รอตรวจรับงาน · คำขอคืนเงิน · **ค่าแบบค้าง** · Lead ที่ยังไม่เปิดโครงการ. Clicking a card filters the queue.
  - "งานรอทำ" is a full-width task-first table (งาน · โครงการ · ยอด · รอนาน · ทำต่อ). Each row opens its drawer; saving removes the row and updates the cards.
  - "โครงการที่ฉันดูแล" is a row of five cards, each with the stage track.
- **Executive home (ExecutiveHome, Q89).**
  - h1 "ภาพรวม", with no header buttons.
  - Brand tabs.
  - Four cards: Lead ทั้งหมด · มูลค่าสัญญาที่กำลังดำเนินการ · เงินรับจริงสุทธิสะสม · รายการรับเงินรอยืนยัน.
  - "โครงการที่ต้องติดตาม" has three clickable rows (count, oldest waiting, ›).
  - "บิลที่ต้องตามเก็บ" is a table, overdue first.
  - A short "Lead ล่าสุด" list.
  - An amber error notice appears if the RPC fails. No RPC change is needed.
- **`/sales` (SalesList).**
  - Columns: code·customer · brand · stage track · next task › · owner · updated. "รอตั้งแต่" is amber and "เกินกำหนดตั้งแต่" is red.
  - Stage tabs show counts. When both brands are shown, the pre-contract stages merge into "ก่อนทำสัญญา".
  - The executive priority chips stay. The header "ตั้งค่า" button goes, because the sidebar has it.

### 3.7 `/summary` — สรุปการเงินบ้านคุณภาพ (FinanceSummary)

- **Names.** The sidebar says "การเงินบ้านคุณภาพ"; the page title is "สรุปการเงินบ้านคุณภาพ". The page is BKP only.
- **KPI cards.**
  - Five cards, plus "รับสุทธิในช่วง" when a period is set. Clicking a card filters the table.
  - The icon tile is tinted by meaning; the card background stays white.
  - "เกินกำหนด" is a red sub-button inside "ค้างตามบิล". It is part of that amount, not added on top.
- **Filters.**
  - Auto-apply, with an owner filter, stage tabs, and a period picker with presets.
  - The closeout chip shows only when its amount is above 0.
  - There is no synthetic toggle.
- **Table.**
  - **No horizontal scroll at any width.** There are four money columns (มูลค่า · รับแล้ว / ค้างตามบิล + เกินกำหนด / ยังไม่ออกบิล / เงินรอยืนยัน) with fixed widths. The closeout amount sits under the cancelled stage tag.
  - It is a table at ≥1024px and cards below (Q75 revised, answer 2).
- **Export.**
  - CSV and print take all filtered rows straight away, reusing the orphan `/summary/export` route. "เลือกเฉพาะบางโครงการ…" is optional.
  - When nothing can be exported, a reason text replaces the disabled button. A toast confirms the download.

### 3.8 `/leads/report` — รายงาน Lead (LeadsReport)

- **Names.** The sidebar says "รายงาน Lead"; h1 "รายงาน Lead ประจำเดือน {เดือน}". The paper heading keeps "Taraville Group".
- **Filters.** Month (month only), brand, and owner. The owner filter is hidden for sales. All auto-apply.
- **Cards.** Three cards: Lead ใหม่ · เปิดโครงการแล้ว · ปิดแล้ว. "ติดต่อแล้ว" is gone (ADR 0059), and the counting is unchanged.
- **Breakdowns.** By stage, using the `/leads` tab groups, and by brand, stacked on the left. By owner on the right, at full height: the five largest are shown, and "ดูทั้งหมด n คน" expands in place, scrolling inside the box past about 10.
- **Sale scope.** The scope rule is unchanged: a sale sees team-wide counts and only their own rows. The screen now says so:
  - cards and boxes are tagged "ทั้งทีม";
  - the table is titled "รายชื่อของฉัน (n)";
  - a one-line note explains the split;
  - there is no owner box, because it would repeat the table count.
- **Name table.** Sortable by date or name. Clicking a name opens the Lead.
- **Print.**
  - The print dialog works like `/summary`: it prints all filtered rows, and "เลือกเฉพาะบางราย…" is optional. The paper summary is computed from the printed rows. There is no CSV.
  - Phone numbers stay on paper (Q81, §4).

### 3.9 Settings — one "ตั้งค่า" page, three tabs (Settings*)

- **Tabs.** โครงการและบ้าน/แปลง · สิทธิ์พนักงาน · บริษัทผู้ออกเอกสาร.
- **Catalog.**
  - Uses the shared table pattern, with add and edit in right drawers.
  - Say-why notes replace hidden buttons.
- **Permissions.**
  - A staff table opens a per-person matrix of the 17 capabilities in `capabilityLabels` (`src/lib/sales/models.ts`).
  - One sticky save with a diff confirm.
- **Issuer.**
  - A company card, edited in a drawer.
  - A contract-text section showing the status and "last saved by/at" (`updated_by`, `updated_at`).
  - A full-page text editor with two explicit saves:
    - "บันทึกและอนุมัติให้ใช้จริง", with the real confirmation checkbox;
    - "บันทึกเป็นร่าง".
  - Consequence warnings.
  - **No test-mode UI** (answer 1, ADR 0062).
- **Blocker buttons** name the action and deep-link to the fix. The real label is "ไปตั้งค่าบริษัทผู้ออกเอกสาร"; "ไปอนุมัติข้อความสัญญา" does not exist in code.
- **Sidebar.** "ตั้งค่า" shows for executives, catalog-right sales and read-only viewers.

### 3.10 Documents, login, account, errors, access

- **Document page (DocumentView, Q91).**
  - A bare paper page with no sidebar.
  - The top bar holds "← กลับ{ที่มา}" and "พิมพ์ / PDF" (`window.print`).
  - A status bar above the paper shows "ยกเลิกเอกสาร · {เหตุผล}", "ร่างสัญญา · รอตรวจและล็อกเพื่อออกเลข" or "รอลงนาม · ยังไม่เป็นสัญญาที่ลงนามแล้ว". It is not red, and it still prints.
  - The paper content does not change. On mobile the paper scales to fit and is view-only.
- **Login.**
  - Show/hide password, a visible username rule, distinct login errors (verify that Supabase returns distinct codes), and a spinner.
  - Session expiry shows "หมดเวลาการใช้งาน…" and returns to the original page; only a same-origin path is accepted.
  - A signed-in user who opens `/login` goes to `/dashboard`.
  - The forgot-password page says "ติดต่อ Support ทาง LINE" with the LINE ID `art`.
- **Account.**
  - Change-password has a live rule checklist and the note "signs out every device".
  - The sidebar user block holds "เปลี่ยนรหัสผ่าน" and "ออกจากระบบ". Sign-out is not red and needs no confirm.
- **Errors.**
  - The error page offers retry, home or login, and a reference code. A `global-error` page is added.
  - The buttons on not-found depend on whether the user is signed in.
  - `/privacy` without a brand asks for one.
- **Access (Q74).**
  - Role-locked pages (`/summary`, permissions, issuers) stay invisible: there is no menu entry, and a direct URL shows "ไม่พบหน้านี้".
  - Capability- or ownership-locked work that can be granted shows "ยังไม่มีสิทธิ์ทำงานนี้". It names what is missing and who grants it.

## 4. Business decisions still open

These are not decisions for the implementer. Each needs the owner (or the PDPA reviewer) before the related phase ships.

- **PDPA review — done (owner, 2026-11-20; Q84).** The reviewed points stand as drawn:
  - The combined attestation checkbox is kept verbatim (Q57).
  - The attestation says the notice was shown "ก่อนกรอกข้อมูล", but the notice step was removed.
  - The survey is visible before consent is ticked.
- **PDPA retention.** What should extend the 12-month review once contact recording is gone (ADR 0059).
- **Print.** Mask phone numbers on the `/leads/report` paper (Q81).
- **Staging — deferred (owner, 2026-11-20).** Test on the local Docker stack (`supabase start` + `npm run dev:local`) for now.
- **Go-live R0 task, needing its own itemised approval.**
  - Purge synthetic data from prod.
  - Set every issuer's `is_synthetic` to false.
  - Decide then whether to remove the synthetic flag, test modes and the "Synthetic" staff accounts (ADR 0062).
- **Forgot-password — decided (owner, 2026-11-20).** Support LINE ID `art`.
- **Finance.** A Taraville finance summary (`/summary` is BKP only); trend charts.
- **Design delivery.**
  - A design delivery date column (the drawer checkbox is UI-only).
  - A printable design-package confirmation (Q32).
- **Quotations.** Older priced revisions stay "offered" and can still be accepted after a newer one; there is no supersede.
- **Survey — decided (owner, 2026-11-22).** "พนักงานขาย" = the Lead owner: the person who fills the form, or the sale an executive picks. Executives cannot own a Lead themselves yet (every owner check requires role `sale`; a separate task with its own ADR if wanted). Migration `20261122090000`.
- **Smaller inconsistencies.**
  - The acceptance chip counts instalments while the table lists projects.
  - "ลองเปลี่ยนคำค้นหรือเลือกสถานะทั้งหมด" shows even when status = all.
- **Backlog.**
  - Staff account management (create, deactivate, reset password).
  - A forced change of temporary passwords (**security priority**).
  - A design-fee table in settings, PDPA retention settings, document numbering, permission role presets, versioned contract text.
  - A customer self-fill kiosk, a duplicate-phone warning on walk-in, draft recovery after session expiry.
  - Report extras: an owner × stage table, trends, channel and budget figures, custom date ranges.

## 5. Backend and implementation notes (facts for the plan, not decisions)

- **RPC changes.**
  - `sales_work_queue` gains a capability-filtered BKP design-fee kind.
  - `sales_case_list` returns the stage and the next task, reusing `nextStep()`.
  - Sales cannot call `sales_executive_work` (executive-only).
- **New query.** Count the contract drafts affected by a contract-text change. Until it exists, show a generic warning.
- **Session return.** `?next=` handling in `requireStaff`, validated as same-origin.
- **Login errors.** Check which error codes Supabase auth returns, for the split login messages.
- **One BKP stage source** (`bkpOverviewStage`). It changes which rows each `/summary` stage tab shows; tell the owner when it ships.
- **Replace `window.confirm`** in:
  - `src/app/sales/[id]/tasks/contract-wizard.tsx:103`
  - `src/app/sales/[id]/tasks/quotation-editor.tsx:86`
  - `src/app/walkin/change-brand-link.tsx:9`
  - `src/app/walkin/close-focus-link.tsx:9`
- **Replace raw `<select>` with `NativeSelect`** in:
  - `src/app/sales/[id]/tasks/payment-paper.tsx`, `quotation-paper-fields.tsx`, `contract-wizard.tsx`
  - `src/app/walkin/lead-form.tsx` (คำนำหน้า), `src/app/walkin/status-controls.tsx` (close reason)
- **Permissions page** (`permissions/page.tsx:53-56`) hand-mirrors the sale default capabilities from SQL. Read them from SQL instead.
- **`/summary/export` and `?print=1`** exist, but nothing links to them.
- **Issuer default.** `is_synthetic` defaults to `true` (`supabase/migrations/20261102172228_sales_money_tables.sql:10`). A migration flips the default to `false` (Q92); the existing rows are handled by the go-live R0 task.
- **Owner reassignment** writes no audit event of the previous owner (`walkin_reassign_lead`). The owner drawer does not need one, so this is noted, not changed.
- **Survey facts.** "รูปแบบที่อยู่อาศัย" is still an active question; only its "คอนโด" option is legacy.

## 6. Redirects for removed or moved pages

| Old | New |
|---|---|
| `/leads/[id]/manage` | `/leads/[id]` |
| `/leads/[id]/history` | `/leads/[id]` with the history drawer open |
| `/sales/[id]?tab=…` / `?task=…` | the matching stage tab or full-page task |
| `/sales/new?lead=&project=` (BKP retry) | `/leads/[id]` (retry card) |
