# Plan — Lead-centred sales flow

Status: agreed 2026-11-05, revised after outsider review the same day. Replaces [plan-sales-case-ux](plan-sales-case-ux.md). A longer record with rejected options is in local ADR 0030 (`docs/adr/` is git-ignored), so the decisions below are the tracked copy.

Branch: `codex/sales-lead-flow`, stacked on PR #17 (`codex/sales-receipt-dev`). Keep #17 in Draft until this ships with it.

Tag: R1 UI refactor plus new read RPCs. Money rules stay the same. The status-only read in Slice 1 is an accepted exception to the separation between Lead reading and financial work.

## Terms

- **Customer Work** (งานของลูกค้า): a Baan Kunapap Project or Taraville Property Sale viewed from its Lead.
- **Work Queue** (งานรอทำ): cross-Lead work that needs an authorized person's action now. It sits beside the full list of work, it does not replace it.

## Decisions

- The Lead is the main way in. Each card opens a read-only summary that links back to the Lead.
- Summary tabs: overview, documents, money. The "แก้ไข/ยกเลิก" tab goes away.
- One task per view at `/sales/[id]?task=<name>[&row=<id>]`.
- Row tasks link from their row. Case exceptions sit in "จัดการรายการขาย"; Lead exceptions sit in "จัดการ Lead". Both are visible lists showing only what status and permission allow.
- Readers without financial access, including a Job Responsible User, see status, case code and Baan Kunapap Project code. Never amounts, documents or Plot codes. They get no next step about money.
- `/sales` keeps the full searchable list, with the Work Queue above it.
- Settings live under `/sales/settings`.
- Closing a Lead with open Taraville work warns. It does not block.
- Leads stay per brand, with no automatic merge.

## Layout rules

- Single column, usable on phone and desktop. Finance/admin staff are the primary users.
- No collapsible section around a form. Read-only rows may still collapse.
- Saving returns to the summary (`salesMutation` drops the query string). Stale or disallowed task links return there too, with a reason.
- Files stay at or under 300 lines. Tokens and styles follow the surrounding sales and walk-in CSS.

## Slice 0 — Checks first

- Fix stale assertions in `scripts/sales-money.check.mts` so it can guard the real flow.
- Update `src/lib/walkin/shared-lead-ui.check.mts` in Slice 1: its mock has no `.rpc`, and the Lead page now calls the RPC for Baan Kunapap too.

## Slice 1 — Lead page and Baan Kunapap entry

RPC, new migration, using `DROP FUNCTION` first if the signature changes:

- `sales_cases_for_lead` returns both brands, with `project_id`, an "can open" flag per row, and status-only rows for readers without financial access. Update the key assertion at `sales-money.check.mts:447`.
- `can_create` for Baan Kunapap needs an open Lead, `case.create`, an active Project, and no existing case on that Project, cancelled included (`sales_cases.project_id` is unique).
- New batch read for Lead list tags, one call per page. It follows the status-only redaction.

Lead page:

- Order: customer, Customer Work, contact record, survey.
- Card shows Project or case code and status. Plot, next step and outstanding appear only with financial access, loaded through a shared loader moved out of `src/app/sales/[id]/page.tsx`.
- Active work first, finished or cancelled work last and dimmed. Cancelled Projects stay listed.
- A Baan Kunapap Lead without a Project shows that state with the open-Project button. After opening, the next step is "เริ่มรายการขาย". If its case was cancelled, the card explains what to do instead of offering a button that fails.
- A failed Customer Work load shows a message in the section and does not throw. A failed tag read hides the tag.
- A row the reader cannot open has no link, because the summary would return 404.

Other:

- `/sales/new` opens from a Lead only. Check `?lead=` on the server, redirect back with a reason if it fails, pass the Lead as a hidden input, and remove the link on `/sales`. The current form silently falls back to the first Lead.
- "จัดการ Lead" page: close or reopen with the open-work warning, cancel Project, consent, reassign. Evidence history gets its own page. Closed state and read-only consent stay visible on the Lead page.
- Lead list tag replaces the current Project code tag: "จองแล้ว", or "A2 · จองแล้ว" with financial access, or "3 งาน". No amounts.

Checks: status-only rows carry no amount, Plot or link; Baan Kunapap with an earlier case gets `can_create=false`.

Done when both brands go from the Lead list to work and back, no form inside `<details>` remains on the Lead page, and walk-in close, reopen, consent and reassign still work.

## Slice 2 — Summary and tasks

Split into three pieces so each can be reviewed alone.

**2a. Summary and registry**

- Pure `availableTasks(...)` in `src/lib/sales`, shared by next step, task lists and guard, with a `*.check.mts` across both brands, statuses and permissions, including that every next step points at a real task.
- Summary header: status, money summary, next step. Move the reservation form out of the header into a task.
- `NextStepInput.instalment` gains a row id. Several pending payments link to the list, not one task.
- Move read-only data off the adjust tab: closeout balance and refunds to money, amendment and closeout documents to documents.

**2b. Money tasks**

- Prepare payment in both forms (general and per instalment), confirm, withdraw, receipt correction as one "what is wrong" task, invoice, acceptance.
- Users without finance keep the `sales_acceptance_detail` path.
- Confirming money is finance's most frequent task, so returning must not add steps. Decide during 2b between a validated `returnTo` and leaving this one task on the money tab, by trying the real flow.

**2c. Exceptions**

- "จัดการรายการขาย", plot change, amendment, closeout, release, refund request and actions, reassignment.
- Risky tasks show a plain summary of the effect above the button and keep the checkbox.

Required tests for task views under `cacheComponents`, in a real browser: Back after saving, reopening a task, submitting twice, and a stale evidence path. Each visit to a money task must start empty. Use `key={sale.version}` on the form wrapper, not the request id, so validation errors keep what was typed. Map `request_conflict` to a "reload the page" message in `salesError`.

Done when no form inside `<details>` remains under `src/app/sales/[id]`, and every step of both brands' paths works by real form submit. Read-only rows may still collapse.

## Slice 3 — Work Queue and settings

- New RPC: money awaiting confirmation, refund requests and acceptance work, filtered by capability per case. No next steps in this round.
- `/sales` shows the queue above the existing list, search and filters.
- Main navigation: รับลูกค้า / รายการ / งานรอทำ.
- Move catalog, issuers and permissions under `/sales/settings`, which keeps proxy matching and `revalidatePath("/sales", "layout")` working. Update the `salesMutation` destinations, including `saveUnit` and `saveDevelopment`. Keep separate read and manage rights: a Sale who can read Plots still sees them.
- Convert the per-capability forms in `/sales/admin` away from `<details>`.

## Slice 4 — Plot table and data

- Table columns: Plot, type, layout, usable area, build status, sale status, price. Filters: location, status. Rows become cards on phones.
- Adding and editing a Plot or Housing Development get their own views.
- Import the 39 Plots once the six open questions on the 20 Oct 2569 list are answered. Writing to production is R0.

## Before merge to main

- Apply all sales migrations before merging, always in that order, with a list of what goes to production and a rollback note. Today only Taraville Leads call `sales_cases_for_lead`; after Slice 1 every Lead does, including the redirect at the end of walk-in entry.
- Confirm whether `main` deploys automatically on Vercel.
- Still unverified: Baan Kunapap contract signing, "no free plots" notice.

## Not doing

Lead list filter by work status, next steps in the Work Queue, blocking Lead close in the database, automatic merging of Leads across brands, a permanent import page, a wizard.
