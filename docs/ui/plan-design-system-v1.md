# Design system v1 Implementation Plan

> **For agentic workers:** execute one PR section at a time, task by task (`- [ ]` steps). Do not commit, push, deploy or apply any migration — the owner commits. If a step needs a new SQL function, a migration, a new dependency, or a choice this plan does not make, stop and report instead of deciding.

**Goal:** Ship the owner-approved design system v1: Noto Sans Thai, navy primary with five status tones, one BKP stage vocabulary, a role-aware left sidebar with role homes, and the project list on `/sales`.

**Architecture:**
- **Tokens:** values change in `src/app/globals.css`. Components keep using semantic Tailwind classes.
- **Status and brand:** two small server components (`Status`, `BrandTag`) replace about 20 hand-styled status spots.
- **Navigation:** the menu is a pure function in `src/lib/nav.ts`. A client sidebar leaf renders it inside the existing per-page `AppShell`. No route group, no new routes except turning the `/sales` redirect into a page.

**Tech Stack:**
- Next.js 16.4.6 (App Router, Server Components, Server Actions);
- Tailwind v4 CSS-first;
- shadcn on Radix, lucide-react, next/font/google;
- checks are `node <file>.check.mts` with `node:assert`.

**Spec:** [docs/ui/design-system.md](design-system.md) (tracked copy of ADR 0056). The as-is behaviour is in `docs/ui/flow-as-is.md` (main checkout).

## Global Constraints

- **Next.js docs.** Before touching layouts, redirects, fonts or Server Actions, read the matching guide in `node_modules/next/dist/docs/`.
- **What not to add.**
  - No new dependency.
  - No SQL, RPC or migration. The only new data read is one `count` query on the existing view `walkin_leads_staged` (Task 9).
- **`src/lib/design-system.check.mts` rules stay.**
  - No raw palette utility (`bg-emerald-700`) or arbitrary colour (`text-[#…]`).
  - No new `*.module.css`.
  - `components/ui` primitives use `h-(--control-h)`, never `h-8` or `h-9`.
- **Print stays.** The 7 `PRINT_MODULES` (receipt, payment, quotation editor, contract paper, document, report, summary print) must render exactly as before.
- **Unchanged:**
  - light only;
  - the `.dense` switch (36px controls and smaller type under `pointer: fine`, 44px targets on touch);
  - routes;
  - permissions;
  - the next-step priority;
  - tab names.
- **One styling system per element.** Copy is Thai and exactly as written here; code and identifiers are English.
- **Files.** Keep each file at 300 lines or fewer, use no `any`, and leave no dead code. Delete a component once its last user is gone.
- **"Done" means checked in a browser.** Ask the owner before each browser check, take before/after screenshots at the widths listed per task, and keep the PR a Draft until it is verified.
- **Live checks.** `scripts/*.check.mts` need a live stack. Run them only against the local stack (`npm run dev:local`), never against production.

## Review Focus

1. **Printed paper must not change.** Opening a receipt, quotation, contract or the monthly report print should look identical before and after the font swap. Pinned in Task 1 (check + print screenshots).
2. **A document state the tone map does not know.** It must render as the inactive tone, never blank and never crash. Pinned in Task 3.
3. **Nested routes highlight the right menu item.** `/leads/report` → รายงาน (not ลูกค้า), `/sales/settings/catalog` → ตั้งค่า for executives, `/sales/<id>` → โครงการ, `/summary` → การเงิน. Pinned in Task 6.
4. **Old links.** Executive follow-up and priority links that pointed at `/dashboard?attention=…` must land on the same filtered list at `/sales`. `/sales?status=…` now shows the list instead of redirecting. Pinned in Task 8.
5. **Leaving the walk-in form, and signed-out pages.**
   - Closing the walk-in form (✕) with unsaved values on an iPad must warn first.
   - Signed-out pages (`/privacy`, `/login`) must show no sidebar.

   Pinned in Task 7 (browser steps).

---

## PR 1 — Font

### Task 1: Noto Sans Thai for the app, old stack kept for paper

**Files:**
- Modify: `src/app/walkin/app-fonts.ts`
- Modify: `src/app/globals.css:43-44`
- Modify: the 5 print modules that inherit the body font. They are the `PRINT_MODULES` entries in `src/lib/design-system.check.mts:37-47` other than `receipt-paper.module.css` and `contract-paper.module.css`, which already name `var(--font-sarabun)`.
- Test: `src/lib/design-system.check.mts`

**Interfaces:**
- Produces:
  - CSS variable `--font-noto-thai`;
  - token `--font-paper`;
  - `--font-body` now resolves to Noto Sans Thai.

- [ ] **Step 1: Add the failing assertion.** In `design-system.check.mts`, for each of those 5 print modules, assert the file text includes `var(--font-paper)`, with the message `"<file> must pin the paper font"`.
- [ ] **Step 2: Run** `node src/lib/design-system.check.mts`. It is expected to FAIL on the first module.
- [ ] **Step 3: Implement.**
  - `app-fonts.ts`:
    - add `Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto-thai", preload: false, display: "swap" })`;
    - keep the Sarabun and Nunito definitions, so their variables still exist for paper;
    - add the new variable to the `appFonts` class list.
  - `globals.css`:
    - `--font-body: var(--font-noto-thai), "Thonburi", Tahoma, sans-serif;`
    - `--font-utility: var(--font-body);`
    - new `--font-paper: var(--font-nunito), var(--font-sarabun), "Thonburi", Tahoma, sans-serif;`
  - Each of the 5 modules: add `font-family: var(--font-paper);` to its outermost rule.
- [ ] **Step 4: Run** `node src/lib/design-system.check.mts && node src/lib/design-tokens.check.mts && npx tsc --noEmit && npm run lint`. All are expected to PASS.
- [ ] **Step 5: Browser check (ask the owner first).**
  - Screens: before/after at 1280 and 768 of `/walkin`, `/leads`, a BKP case.
  - Print preview: before/after of a receipt, a quotation, a contract and `/leads/report`. Expected: screens change typeface, print previews are pixel-identical.

## PR 2 — Colour and status

### Task 2: Token values

**Files:**
- Modify: `src/app/globals.css` (`:root` colours, aliases, `@theme inline`, shadows, backdrop)
- Modify: `src/app/design-system/page.tsx:13-14` (swatches)

**Interfaces:**
- Produces these Tailwind colours:
  - `success`, `success-ink`, `success-tint`;
  - `primary-tint`;
  - `brand-bk-accent`, `brand-tv-accent`.
- Every existing token name keeps working.

- [ ] **Step 1: Set the values.**

  | Token | New value |
  |---|---|
  | `--ink` | `#1C1917` |
  | `--muted-foreground` | `#78716C` |
  | `--primary` | `#1E3A5F` |
  | `--tint` | `#F5F5F4` |
  | `--line` | `#E7E5E4` |
  | `--line-strong` | `#D6D3D1` |
  | `--control-border` | `#857E79` |
  | `--canvas` | `#FAFAF9` |
  | `--skeleton` | `#E7E5E4` |
  | `--warn-tint` | `#FEF3C7` |
  | `--danger-tint` | `#FEE2E2` |
  | `--brand-bk` | `#303C54` |
  | `--brand-tv` | `#30B448` |

  - New tokens:

  | Token | Value |
  |---|---|
  | `--success` | `#16A34A` |
  | `--success-ink` | `#166534` |
  | `--success-tint` | `#DCFCE7` |
  | `--primary-tint` | `#E9EEF5` |
  | `--brand-bk-accent` | `#E49024` |
  | `--brand-tv-accent` | `#F08424` |

  - Map each new token in `@theme inline` as `--color-<name>`.
  - Shadows and `--backdrop`: change `15 23 42` to `28 25 23`.
- [ ] **Step 2: Contrast one-off** (not committed). Run it with node. Every printed ratio must meet its minimum.

```js
const L = h => { const c = [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255).map(v => v <= .03928 ? v/12.92 : ((v+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
const ratio = (a,b) => { const [x,y] = [L(a),L(b)].sort((p,q)=>q-p); return (x+.05)/(y+.05); };
for (const [fg,bg,min] of [["#FFFFFF","#1E3A5F",4.5],["#78716C","#FAFAF9",4.5],["#166534","#DCFCE7",4.5],["#92400E","#FEF3C7",4.5],["#991B1B","#FEE2E2",4.5],["#1E3A5F","#E9EEF5",4.5],["#857E79","#FFFFFF",3]]) console.log(fg,bg,ratio(fg,bg).toFixed(2),">=",min);
```

- [ ] **Step 3: Add swatches.** Put the new tokens on `/design-system`. Run `npx tsc --noEmit && npm run lint && node src/lib/design-system.check.mts`. Expected: PASS.

### Task 3: `Status` and `BrandTag`, plus tone maps

**Files:**
- Create: `src/components/status.tsx`, `src/components/brand-tag.tsx`
- Modify:
  - `src/lib/sales/models.ts:46` (next to `caseStatusLabels`);
  - `src/lib/walkin/lead-stage.ts` (next to `STAGE_LABELS`);
  - `src/lib/sales/document-library.ts:12,35`.
- Test: the existing check that imports `document-library.ts` (grep `document-library` in `*.check.mts`). If none exists, create `src/lib/sales/document-library.check.mts`.

**Interfaces:**
- Produces:
  - `export type StatusTone = "success" | "waiting" | "fix" | "progress" | "inactive"` (in `status.tsx`);
  - `Status({ tone, children }: { tone: StatusTone; children: ReactNode })`;
  - `BrandTag({ brand }: { brand: Brand })`. `Brand` comes from `src/lib/walkin`, and the label comes from the brand label map that already exists there;
  - `BrandMark({ brand }: { brand: Brand })`, the mark alone, exported from `brand-tag.tsx`. The sidebar logo uses it, so no other file needs brand colour classes;
  - `caseStatusTones: Record<CaseStatus, StatusTone>`;
  - `leadStageTones: Record<LeadStage, StatusTone>`;
  - `refundStates: Record<RefundState, { label: string; tone: StatusTone }>` in `models.ts`. Use the existing key and label sets: it replaces the duplicate maps at `bkp-money-section.tsx:15` and `summary-sections.tsx:29`;
  - a `tone` field on each document-library entry.
- `StatusTone` is a type-only export, so `.ts` files may import it.

- [ ] **Step 1: Write the failing test.** A document whose state string is not in the map must get `tone === "inactive"`. Assert it in the document-library check.
- [ ] **Step 2: Run the check.** It is expected to FAIL because `tone` is undefined.
- [ ] **Step 3: Implement the two components and the tone maps.**
  - `Status` classes, all from tokens:

  | Tone | Classes |
  |---|---|
  | success | `bg-success-tint text-success-ink` |
  | waiting | `bg-warn-tint text-warn-ink` |
  | fix | `bg-danger-tint text-danger-ink` |
  | progress | `bg-primary-tint text-primary` |
  | inactive | `bg-secondary text-muted-foreground` |

  - `Status` pill: `rounded-full px-2.5 py-0.5 text-xs font-medium`, with a `size-1.5 rounded-full bg-current` dot.
  - `BrandTag`: a white chip with a border, a 12px mark and the brand name.
    - BKP mark: `bg-brand-bk` with a `bg-brand-bk-accent` square at the bottom centre.
    - Taraville mark: `bg-brand-tv` with a `bg-brand-tv-accent` bar on top.
  - Tone values:

  | Map | Tones |
  |---|---|
  | Case status | เตรียมข้อมูล, จองแล้ว, ทำสัญญาแล้ว → progress · ครบยอดแล้ว → success · ยกเลิก → inactive |
  | Lead stage | รับเข้า → waiting · ติดต่อแล้ว → progress · เปิดโครงการแล้ว → success · ปิด → inactive |
  | Refund | รออนุมัติ, อนุมัติแล้ว รอจ่ายจริง → waiting · จ่ายคืนแล้ว → success · ไม่อนุมัติ → fix · ถอนคำขอ → inactive |
  | Documents | issued, accepted, signed → success · awaiting acceptance or signature → waiting · draft → progress · cancelled or unknown → inactive |

- [ ] **Step 4: Run** the document-library check, `npx tsc --noEmit` and `npm run lint`. Expected: PASS.

### Task 4: Move every status spot to `Status` / `BrandTag`

**Files (modify):**
1. `src/app/sales/[id]/case-header.tsx:31`
2. `src/app/dashboard/page.tsx:121`
3. `src/app/leads/[id]/customer-work.tsx:24,63,77`
4. `src/app/leads/lead-cards.tsx:27,29`
5. `src/app/leads/[id]/page.tsx:50`
6. `src/app/sales/[id]/document-library.tsx:27`
7. `src/app/sales/[id]/contract-section.tsx` (`ws.status` with `data-done` / `data-pending`)
8. `src/app/sales/[id]/finance-collection.tsx:61,66` + `finance-collection-styles.ts:19`
9. `src/app/sales/[id]/instalment-list.tsx:26`
10. `src/app/sales/[id]/bkp-money-section.tsx:15,69` and `src/app/summary/summary-sections.tsx:29,70,147`
11. `src/app/sales/[id]/tasks/money-tasks.tsx:55-59` (ยกเลิกแล้ว → inactive)
12. `src/app/summary/summary-styles.ts:40-42` (received → `text-success-ink`, billed → `text-primary`, pending `text-warn-ink`, overdue `text-danger-ink`)
13. `src/app/dashboard/overview-styles.ts:16-21,44-45` + `overview.tsx` (positive → `text-success-ink`, blue → `bg-primary-tint text-primary`, brand badge → `BrandTag`, due badge → `bg-primary-tint`)
14. `src/app/sales/settings/settings-styles.ts:31` + `catalog/page.tsx:113` (ว่าง → success, กันไว้แล้ว → progress, ปิดใช้งาน → inactive)
15. the quotation section that uses `quotation-section-styles.ts:12` (`data-accepted`)
16. `src/app/sales/evidence-upload.tsx:46` (`text-primary` → `text-success-ink`)
17. `src/app/sales/[id]/bkp-progress-styles.ts:11-25` (done marker → `border-success text-success`, current stays primary)
18. `src/app/design-system/primitives.tsx:102-103` (show every `Status` tone and both `BrandTag`s)

Then delete `ws.status` (`workspace-styles.ts:16-17`) and the `--brand-*-tint` tokens once nothing uses them.

**Test:** `src/lib/design-system.check.mts`

- [ ] **Step 1: Add the failing guard.** In `design-system.check.mts`, fail on any `.ts`/`.tsx` file outside `src/components/status.tsx` and `brand-tag.tsx` that matches:
  - `/data-\[(done|accepted)=true\][^"\s]*:text-primary/`, or
  - `/\b(text|bg)-brand-(bk|tv)(-tint)?\b/`.

  The message names the file.
- [ ] **Step 2: Run** `node src/lib/design-system.check.mts`. It is expected to FAIL and list the files above.
- [ ] **Step 3: Migrate each file** in the list to `Status` / `BrandTag` / the mapped classes.
- [ ] **Step 4: Run** `node src/lib/design-system.check.mts && node src/lib/design-tokens.check.mts && npx tsc --noEmit && npm run lint`, plus every `src/**/*.check.mts`. Expected: PASS.
- [ ] **Step 5: Browser check (ask first).** Before/after at 1280 and 768 of:
  - a BKP case (ภาพรวม, สัญญา, การเงิน);
  - a Taraville case;
  - `/summary`;
  - `/dashboard` as Executive;
  - `/leads`;
  - `/sales/settings/catalog`.

  Expected:
  - "done" states are green;
  - waiting states are amber;
  - overdue is red;
  - actions are navy.

## PR 3 — One stage vocabulary

### Task 5: Labels, compact progress text, agreement check

**Files:**
- Modify:
  - `src/lib/sales/bkp-workflow.ts:12-18`: label `design` → `ออกแบบ`, `money` → `รับชำระ`. Keys are unchanged.
  - `src/lib/sales/case-progress.ts:21`: `กำหนดค่าออกแบบ` → `ออกแบบ`.
  - `src/app/sales/[id]/bkp-progress.tsx:25-26`.
  - The component that renders `bkpOverviewStages` (`src/app/sales/[id]/bkp-workflow.tsx`): add the design-fee detail.
- Create: `src/lib/sales/stage-agreement.check.mts`
- Maybe modify: `src/lib/sales/case-layout.check.mts:148`, only if it asserts the old labels.

**Interfaces:**
- Consumes:
  - `projectProgress()` from `case-progress.ts`;
  - `bkpWorkflow()` / `bkpOverviewStage()` from `bkp-workflow.ts`.

  Their signatures do not change.

- [ ] **Step 1: Write the failing check** `stage-agreement.check.mts`.
  - **Vocabulary.**
    - `projectProgress(<BKP fixture, not settled>).steps` deep-equals `["เปิดโครงการ","ออกแบบ","ใบเสนอราคา","สัญญา","รับชำระ"]`.
    - `Object.values(bkpOverviewStages).map(s => s.label)` deep-equals the same list.
    - The settled BKP fixture still ends with `"ชำระครบ"`.
  - **Agreement.**
    - Build one fixture for each of these states:
      - no design plan;
      - design plan only;
      - design fee partly paid;
      - quotation issued;
      - quotation accepted;
      - contract draft;
      - contract signed;
      - fully paid.
    - Map overview keys to indices: `{intake:0, design:1, quotation:2, contract:3, money:4}`. Collect the fixture names where the overview index ≠ `projectProgress(...).current`.
    - Print them with `console.table`.
    - `assert.deepEqual(disagreements, KNOWN_DISAGREEMENTS)`. On the first run, record what it finds in `KNOWN_DISAGREEMENTS`, with a comment that unifying the two derivations is a separate owner decision.
- [ ] **Step 2: Run** `node src/lib/sales/stage-agreement.check.mts`. It is expected to FAIL on the vocabulary asserts.
- [ ] **Step 3: Implement.**
  - Change the two labels.
  - In `bkp-progress.tsx` compact mode, build the text from `progress` (already in scope): `ขั้นที่ ${progress.current + 1} จาก ${progress.steps.length} · ${progress.steps[progress.current]}`. Keep the settled text.
  - If `bkpFlowStages` `.label` / `.hint` then have no reader, delete those fields. Keep the ids, because `contract-paper.check.mts:128-132` asserts them.
  - Under ออกแบบ in the overview strip, show `ค่าแบบ ${paid}/${total} งวด`. Derive it from the design-billing data the strip's component already receives, the same data `bkpWorkflow` uses for `done.fees`.
  - If that data is not available there without a new query, skip the detail and report it.
- [ ] **Step 4: Run** `node src/lib/sales/stage-agreement.check.mts && node src/lib/sales/case-progress.check.mts && node src/app/summary/summary-model.check.mts && node src/lib/sales/contract-paper.check.mts && node src/lib/sales/case-layout.check.mts && npx tsc --noEmit && npm run lint`. Expected: PASS. Report the `KNOWN_DISAGREEMENTS` table to the owner.
- [ ] **Step 5: Browser check (ask first).** Check that the same five names appear on:
  - a BKP case's ภาพรวม strip;
  - a BKP task page (compact text);
  - the `/summary` stage filter;
  - a Lead page project card;
  - the executive table.
- [ ] **Step 6: Owner step.** Paste the **Work Stage** glossary entry from `docs/ui/design-system.md` §6 into `CONTEXT.md` (main checkout).

## PR 4 — Sidebar, role landing, walk-in focus mode

### Task 6: Navigation model

**Files:**
- Create: `src/lib/nav.ts`, `src/lib/nav.check.mts`

**Interfaces:**
- Produces:
  - `export type NavIcon = "home" | "overview" | "walkin" | "leads" | "projects" | "finance" | "report" | "settings"`
  - `export type NavItem = { href: string; label: string; icon: NavIcon }`
  - `export function navItems(role: "sale" | "executive" | "staff"): NavItem[]`
  - `export function activeHref(pathname: string, items: NavItem[]): string | undefined`

- [ ] **Step 1: Write the failing check** `nav.check.mts`.
  - Executive labels, in order: `["ภาพรวม","รับลูกค้า","ลูกค้า (Lead)","โครงการ","การเงิน","รายงาน","ตั้งค่า"]`, with hrefs `["/dashboard","/walkin","/leads","/sales","/summary","/leads/report","/sales/settings"]`.
  - `"sale"` and `"staff"` labels: `["หน้าหลัก","รับลูกค้า","ลูกค้า (Lead)","โครงการ","รายงาน"]`.
  - `activeHref` with executive items:

  | Pathname | Expected |
  |---|---|
  | `/leads/report` | `/leads/report` |
  | `/leads/1a2b` | `/leads` |
  | `/sales/settings/catalog` | `/sales/settings` |
  | `/sales/1a2b` | `/sales` |
  | `/summary` | `/summary` |
  | `/dashboard` | `/dashboard` |
  | `/dashboardx` | `undefined` |
  | `/account/password` | `undefined` |

- [ ] **Step 2: Run** `node src/lib/nav.check.mts`. It is expected to FAIL because the module is missing.
- [ ] **Step 3: Implement.**
  - `activeHref` returns the longest item `href` that equals `pathname` or is followed in it by `/`.
  - ตั้งค่า appears for executives only. The sidebar does not call `salesBootstrap`, which loads every Lead and customer. Sales who hold catalog rights keep the capability-gated ตั้งค่า button on `/sales` (Task 8).
- [ ] **Step 4: Run** the check. Expected: PASS.

### Task 7: Sidebar shell, landing, walk-in focus mode

**Files:**
- Modify:
  - `src/app/walkin/app-shell.tsx`;
  - `src/components/app-shell-styles.ts`;
  - `src/app/walkin/page.tsx:34,46`, `src/app/walkin/page-skeleton.tsx:6`;
  - `src/app/login/actions.ts:23`, `src/app/page.tsx:4`;
  - `src/app/not-found.tsx:13`, `src/app/account/password/page.tsx:37`;
  - `scripts/sales-foundation.check.mts:69`.
- Create: `src/app/walkin/app-sidebar.tsx` (`"use client"`)
- Delete: `src/app/walkin/nav-tabs.tsx` and `src/app/walkin/account-menu.tsx`, once nothing imports them.

**Interfaces:**
- Consumes: `navItems` and `activeHref` (Task 6).
- Produces:
  - `AppShell({ children, staff, wide, focus }: { children: ReactNode; staff?: Staff; wide?: boolean; focus?: boolean })`;
  - `AppSidebar({ items, staff }: { items: NavItem[]; staff: Staff })`.

- [ ] **Step 1: Read** `node_modules/next/dist/docs/` on `redirect` in Server Actions and on `usePathname`.
- [ ] **Step 2: Implement `AppShell`.** It has three layouts:
  - **No `staff`:** the current minimal header (`/privacy`).
  - **`focus`:** a header with an ✕ link to `/dashboard` (`aria-label="ปิดและกลับหน้าหลัก"`) and the group name, with no sidebar.
  - **Otherwise:** sidebar plus main. `main` keeps the existing width rules (880/1040, `wide` 1280).
- [ ] **Step 3: Implement `AppSidebar`.**
  - **Contents:**
    - the group mark: `BrandMark` for BKP, then `BrandMark` for Taraville (Task 3);
    - "Taraville Group / บ้านคุณภาพ · ธาราวิลล์";
    - the items, with lucide icons: House, LayoutDashboard, UserPlus, Users, BriefcaseBusiness, Wallet, ChartColumn, SlidersHorizontal (check they exist in the installed lucide-react);
    - the account card at the bottom: name, role label, link เปลี่ยนรหัสผ่าน → `/account/password`, and the logout form moved from `account-menu.tsx`.
  - **Active item:** `bg-primary-tint text-primary font-semibold` with `aria-current="page"`.
  - **Widths:**

  | Viewport | Sidebar |
  |---|---|
  | ≥1180px (`min-[1180px]:`) | full, 248px |
  | 768–1179px | icon rail, 64px, label as `title` + `sr-only` text |
  | <768px | top bar with a menu button that opens a left drawer |

  - **Drawer:** use the native `<dialog>` wrapper in `src/components/ui/dialog.tsx` if it accepts a positioning `className`; otherwise use a local `<dialog>` with `showModal()` and `native-dialog-styles`.
  - **Targets:** every item is at least `min-h-(--tap-min)`.
- [ ] **Step 4: Walk-in focus mode.**
  - `walkin/page.tsx` and `page-skeleton.tsx` pass `focus`.
  - The ✕ must warn about unsaved values exactly like `src/app/walkin/change-brand-link.tsx`. If that guard cannot see the form from the shell header, render the ✕ in the walk-in page's own header instead, and keep the shell header without it.
- [ ] **Step 5: Landing.**
  - Change these to `/dashboard`:
    - `login/actions.ts:23` `redirect("/walkin")`;
    - `page.tsx:4`;
    - the logo `href`;
    - `not-found.tsx:13`, label กลับหน้าหลัก;
    - `account/password/page.tsx:37`, label กลับหน้าหลัก.
  - Keep รับลูกค้ารายถัดไป and the `/leads` header button pointing at `/walkin`.
  - In `scripts/sales-foundation.check.mts:69`, change the expected redirect prefix to `/dashboard`. Run it only against `npm run dev:local`.
- [ ] **Step 6: Run** `node src/lib/nav.check.mts && node src/lib/design-system.check.mts && npx tsc --noEmit && npm run lint`. Expected: PASS.
- [ ] **Step 7: Browser check (ask first; the owner names the Sale and Executive test accounts).**
  - Widths: 1440, 1024, 820 (iPad portrait) and 375.
  - Check each of these:
    - the menu items per role;
    - the active item on `/leads/report`, `/sales/<id>` and `/summary`;
    - landing after login;
    - the drawer opens, closes with Esc, and returns focus;
    - `/walkin` shows no sidebar, and ✕ with typed values warns;
    - `/privacy` shows no sidebar;
    - no horizontal scroll at 375.

## PR 5 — Sale home and `/sales` project list

### Task 8: Project lists move to `/sales`

**Files:**
- Create: `src/app/sales/project-list.tsx` (server)
- Modify:
  - `src/app/sales/page.tsx` (redirect → page);
  - `src/app/dashboard/page.tsx:44-54,79-126`;
  - `src/app/sales/executive-dashboard.tsx:33-39+`;
  - `src/lib/sales/dashboard-data.ts:40`.

**Interfaces:**
- Produces:
  - `SaleProjectList({ cases, staffId, filters, ownership, basePath }: { cases: CaseListRow[]; staffId: string; filters: { q?: string; brand?: string; status?: string }; ownership: "all" | "mine" | "others"; basePath: string })`. Use the existing row and ownership types from `models.ts` / `project-ownership.ts`.
  - `ExecutiveDashboard` gains `basePath: string`, which replaces every hard-coded `/dashboard` in its hrefs.

- [ ] **Step 1: Extract the Sale list into `SaleProjectList`.** That is the filter form, ownership tabs, rows and 100-row note, taken from `dashboard/page.tsx`. `ownershipHref` builds hrefs from `basePath`.
- [ ] **Step 2: Turn `sales/page.tsx` into the list page.**
  - It calls `salesBootstrap()` for role and workspace.
  - **Executive:** `executiveWork(...)` + `ExecutiveDashboard` with `basePath="/sales"`.
  - **Others:** `salesCaseList(filters)` + `SaleProjectList` with `basePath="/sales"`.
  - Page title "โครงการ".
  - Header button ตั้งค่า → `/sales/settings` when `workspace.can_catalog || workspace.can_admin || workspace.developments.length > 0`. This is the check moved from `dashboard/page.tsx:55-56`.
  - Search params keep their current names.
- [ ] **Step 3: Repoint links.**
  - `dashboard-data.ts:40` follow-up hrefs → `/sales?attention=…`.
  - Remove the project list, the project table and the ตั้งค่า button from `/dashboard`.
- [ ] **Step 4: Run** `node src/app/dashboard/project-ownership.check.mts && npx tsc --noEmit && npm run lint`. Expected: PASS.

### Task 9: Role homes on `/dashboard`

**Files:**
- Modify: `src/app/dashboard/page.tsx`, `src/lib/walkin/queries.ts`

**Interfaces:**
- Produces: `uncontactedLeadCount(supabase: SupabaseClient, ownerId: string): Promise<number | null>`. It runs `from("walkin_leads_staged").select("id", { count: "exact", head: true }).eq("stage", "received").eq("owner_id", ownerId)` and returns `null` on error.

- [ ] **Step 1: Sale home, in order.**
  - Heading `สวัสดี ${staff.full_name}`, with the Thai date below.
  - Four count cards, using the existing stat-card styles in `src/components` and counts from `salesWorkQueue()`:
    - เงินเข้ารอยืนยัน (`payment_pending`);
    - รอตรวจรับงาน (`acceptance`);
    - คำขอคืนเงิน (`refund_pending` + `refund_approved`);
    - Lead ที่ยังไม่ได้ติดต่อ (`uncontactedLeadCount`; show "—" when `null`).
  - No money amounts, and no "ครบกำหนดใน 7 วัน", because both need a new RPC.
  - The งานรอทำ list with `Status tone="waiting"`, plus `BrandTag` if the queue row has a brand.
  - "โครงการที่ฉันดูแล": the first 5 of the Sale's own cases from `salesCaseList`, with ดูทั้งหมด → `/sales?ownership=mine`.
- [ ] **Step 2: Executive home.** Keep `DashboardOverview` and add ดูโครงการทั้งหมด → `/sales`.
- [ ] **Step 3: Run** `npx tsc --noEmit && npm run lint` and every `src/**/*.check.mts`. Expected: PASS.
- [ ] **Step 4: Browser check (ask first).** Sale and Executive at 1280 and 375:
  - Sale lands on the home;
  - the counts match the งานรอทำ list;
  - executive follow-up links open the filtered `/sales`;
  - `/sales?status=…` shows the filtered list.

## Out of scope for v1 (recorded so nobody adds them silently)

- **Business-rule decisions:**
  - the "ทำคู่กันได้" card;
  - unifying the two current-step derivations, which changes `/summary` filtering;
  - giving Executives a work queue;
  - "ครบกำหนดใน 7 วัน" and money totals on the Sale home, which need RPCs.
- **Unchanged:** print documents.
- **Owner or Figma follow-ups:**
  - switching the Figma text styles to Noto Sans Thai;
  - the `CONTEXT.md` entry, which is an owner step.

## Execution

- **One PR at a time.**
  - Each PR section goes to one implementer subagent (`model: "sonnet"`).
  - The brief is: this file's path + the PR section + Global Constraints + "no commit, push or migration; stop on a design fork".
- **Review.** The main session reads `git diff` itself before reporting.
- **PR.** The owner commits and opens a Draft PR into `dev`; ask whether it should be Thai or English.
