# Design system v1

Status: decided by the owner on 2026-11-19 (ADR 0056, git-ignored; this file is the tracked copy). It changes the look and navigation only. Data, permissions, routes and business rules stay as they are. It builds on [plan-shadcn-migration](plan-shadcn-migration.md) (ADR 0031): Tailwind v4 + shadcn on Radix, tokens in `src/app/globals.css`, light only, `.dense` density under `pointer: fine`.

Visual reference: the Figma file "Untitled", Page 2 (`G8BAzX7STervFQjfrnsO5V`). It has Foundations, Components and three screens: Sale home, BKP project overview and iPad walk-in. Its text styles still use IBM Plex Sans Thai Looped; switch them to Noto Sans Thai.

## 1. Colour

| Token | Value | Use |
|---|---|---|
| bg/canvas | `#FAFAF9` | page background |
| bg/surface | `#FFFFFF` | cards, inputs |
| bg/subtle | `#F5F5F4` | table header, segmented control |
| border/default · strong · control | `#E7E5E4` · `#D6D3D1` · `#857E79` | dividers · emphasis · input borders |
| text/primary · secondary · muted | `#1C1917` · `#57534E` · `#78716C` | |
| primary · hover · subtle | `#1E3A5F` · `#162C49` · `#E9EEF5` | buttons, links, current step, active nav |

**Rules.**
- Primary marks things you can act on.
- Green means success and nothing else.
- Brand colours only identify a brand. They never theme the UI.

## 2. Status: five groups, app-wide

Every status in the app maps to one of these groups. No page picks its own colours.

| Group | Text / bg / solid | Statuses |
|---|---|---|
| Success | `#166534` / `#DCFCE7` / `#16A34A` | ชำระครบ, ยืนยันแล้ว, ลงนามแล้ว, ลูกค้ายอมรับแล้ว, จ่ายคืนแล้ว |
| Waiting on someone | `#92400E` / `#FEF3C7` / `#D97706` | รอยืนยัน, รอชำระ, รอลงนาม, รอลูกค้ายอมรับ, รออนุมัติ, รอตรวจรับ |
| Needs fixing | `#991B1B` / `#FEE2E2` / `#DC2626` | เกินกำหนด, ถูกบล็อก, ไม่อนุมัติ |
| In progress | primary / primary-subtle | current step, draft being edited, จองแล้ว |
| Finished / inactive | `#44403C` / `#F5F5F4` | not started, ยกเลิก, ถอน, ปิดรายการ |

## 3. Brand tag

The brand tag is a white tag with a 14px mark in the logo colours, followed by the brand name.

| Brand | Mark colours |
|---|---|
| BKP | navy `#303C54`, orange `#E49024`, red `#E4483C` |
| Taraville | green `#30B448`, orange `#F08424`, red-orange `#F05424` |

The values were sampled with `sharp` from the logo JPEGs in `docs/assets/brand/`. They are quantised to steps of 12, so each channel is accurate to about ±6. Code uses only `brand-bk` / `brand-bk-accent` and `brand-tv` / `brand-tv-accent`.

## 4. Typeface

**Noto Sans Thai** for everything.
- Google Fonts serves the thai, latin and latin-ext subsets, so it needs no Latin partner.
- Weights: 400, 500 and 600.
- It replaces Nunito + Sarabun in `src/app/walkin/app-fonts.ts`.

Target sizes for `pointer: fine` (size/line height in px):

| Style | Size / line height | Weight |
|---|---|---|
| KPI | 30/38 | 600 |
| H1 | 24/34 | 600 |
| H2 | 20/30 | 600 |
| H3 | 16/26 | 600 |
| Body | 14/22 | 400 |
| Body strong | 14/22 | 500 |
| Label | 13/20 | 500 |
| Caption | 12/18 | 400 |

Touch keeps body text at 16/26 and 44px controls. Under `pointer: fine`, controls stay 36px. Money columns use `tabular-nums`.

## 5. Shell and landing

- **Layout.** A left sidebar replaces the top tabs. It holds the group mark, the menu and an account card at the bottom.

| Role | Menu | Lands on after login |
|---|---|---|
| Sale | หน้าหลัก · รับลูกค้า · ลูกค้า (Lead) · โครงการ · รายงาน | หน้าหลัก: Work Queue, key money figures, own projects |
| Executive | ภาพรวม · รับลูกค้า · ลูกค้า (Lead) · โครงการ · การเงิน · รายงาน · ตั้งค่า | ภาพรวม (the existing executive overview) |

- **Menu entries for existing pages.**

| Menu item | Page |
|---|---|
| การเงิน | `/summary` |
| รายงาน | `/leads/report` |
| ตั้งค่า | `/sales/settings`: in the sidebar for Executives only. A Sale with catalog rights reaches it from the ตั้งค่า button on `/sales`, which uses the existing capability check. |

- **Why ตั้งค่า is not capability-gated in the sidebar.** The sidebar would have had to call `sales_bootstrap` on every page, and that loads every Lead and customer.
- **Widths.** The sidebar is full at ≥1180px, an icon rail at 768–1179px and a drawer below 768px.
- **Walk-in.** `/walkin` is a full-screen focus mode with no sidebar. Its ✕ warns about unsaved values.
- **Project list.** It lives at `/sales` for both roles, and `/dashboard` is the role home.
- **Unchanged:** routes and permissions.

## 6. Stage names (Work Stage)

| Brand | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| BKP | เปิดโครงการ | ออกแบบ | ใบเสนอราคา | สัญญา | รับชำระ |
| Taraville | เปิดโครงการ | จองแปลง | สรุปการจอง | สัญญา | รับชำระ |

- **Where the labels change:**
  - the task progress card and the overview strip (`src/lib/sales/bkp-workflow.ts`);
  - the `/summary` stage filter;
  - Lead cards and the executive table (`src/lib/sales/case-progress.ts`).
- **Design-fee collection** shows as a detail under ออกแบบ ("ค่าแบบ 2/3 งวด"). The "ทำคู่กันได้" card from Figma is deferred: choosing which task it offers is a business-rule decision.
- **v1 changes labels only.** The overview strip and `/summary` filter derive the current step one way, and the progress card, Lead cards and executive table derive it another. Unifying the two changes `/summary` results, so it is a separate owner decision. A check records where they disagree.
- **Unchanged:** the next-step priority and the tab names.

Glossary entry for `CONTEXT.md`. Insert it after **Work Queue**:

```markdown
**Work Stage** (staff UI label: ขั้น):
One of the five named phases of Customer Work, shown in the same words on every screen. Baan Kunapap: เปิดโครงการ · ออกแบบ · ใบเสนอราคา · สัญญา · รับชำระ. Taraville: เปิดโครงการ · จองแปลง · สรุปการจอง · สัญญา · รับชำระ. Collecting the design fee belongs to ออกแบบ and may run alongside ใบเสนอราคา; it is not a stage of its own. Chosen by the owner on 2026-11-19.
_Avoid_: รับลูกค้า, รับค่าแบบ, ออกแบบและรับค่าแบบ, กำหนดค่าออกแบบ, สัญญาและงวด, การเงิน (as stage names)
```

## 7. Decided in the planning round (2026-11-19)

- **Devices.** iPad for walk-in, desktop for back office, phone for quick actions.
- **Sidebar, walk-in, project list.** As in §5.
- **Sale home uses no new SQL or RPC.**
  - It shows counts from the Work Queue plus the count of the Sale's Leads still รับเข้า (from the existing view `walkin_leads_staged`).
  - It leaves out "ครบกำหนดใน 7 วัน" and money totals.
- **Print paper keeps Nunito + Sarabun exactly** (`--font-paper`). Only screens move to Noto Sans Thai.
- **Delivery.** Five PRs into `dev`, in this order: font → colour + status → stage names → shell → Sale home and `/sales`. See [plan-design-system-v1](plan-design-system-v1.md).
