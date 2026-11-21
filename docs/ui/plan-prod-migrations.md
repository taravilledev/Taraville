# Plan: apply the UX-redesign migrations to prod

Date: 2026-11-22. Status: **ready, waiting for owner approval (R0)**. Nothing in this plan has been run on prod; prod was only read.

## Confirmed facts (do not re-derive)

- **Prod project:** `gquytrggcghnhlrpzcli`, linked in the main checkout `supabase/.temp/project-ref`. The Supabase MCP connector cannot see this organization; use the CLI from the main checkout.
- **Prod migration history:** ends at `20261119120000`, and matches the files up to that version (`supabase migration list --linked`, 2026-11-22).
- **Pending:** `dev` (after merging PRs #28–#36) holds exactly six newer files.
- **Signatures:** every function the migrations replace has the same signature on prod, so `CREATE OR REPLACE` replaces in place with no overload. The three functions the migrations create do not exist on prod yet.
- **Column default:** prod `private.sales_issuers.is_synthetic` defaults to `true`.
- **Rollback:** `scripts/ux-redesign-prod.rollback.sql` holds the prod bodies of the five replaced functions, dumped read-only. It was dry-run on local Docker inside a transaction that ended with ROLLBACK, and ran clean.
- **Code on an old DB:** the new code works on the old DB, in a degraded way (PR #31, #32 Impact). The one exception is the staff-permissions page, which shows "โหลดค่าเริ่มต้นของสิทธิ์ไม่ได้" and will not save until `20261121120000` is applied (PR #34).
- **Old code on the new DB:** this breaks on one migration. With `20261121090100` applied, the code currently on prod rejects the new `design_fee` queue kind, and the sale home shows a notice instead of the queue (PR #31).

## The six migrations

| # | File | What it changes | Replaces (prod) | Creates |
|---|---|---|---|---|
| 1 | `20261121090000_sales_case_facts.sql` | Shared case facts. The executive work list and the case list read it. | `private.sales_executive_work(text,text,text)`, `private.sales_case_list(text,text,text)` | `private.sales_case_facts(uuid)` |
| 2 | `20261121090100_sales_work_queue_design_fee.sql` | Adds the `design_fee` kind to the work queue. | `private.sales_work_queue()` | — |
| 3 | `20261121090200_sales_case_facts_design.sql` | Adds design-fee facts to case facts. | (its own #1) | — |
| 4 | `20261121120000_sales_capability_defaults.sql` | Role defaults in one SQL source. Results were identical on 1,785 local rows. | `private.sales_allowed(text,uuid,uuid)` | `private.sales_default_actions(text)`, `public.sales_capability_defaults()` |
| 5 | `20261121120100_issuer_synthetic_default_false.sql` | New issuer rows default to `is_synthetic = false`. Existing rows are untouched. | column default | — |
| 6 | `20261122090000_walkin_survey_sales_staff_is_owner.sql` | The survey "พนักงานขาย" = the Lead owner. | `private.walkin_create_lead_with_privacy(…9 args)` | — |

No migration deletes or updates data.

## Order (recommended)

1. **Release the code to prod.** Merge `dev` → `main` (or whatever the owner uses to promote). **DECISION PENDING:** the release flow is not defined for this repo (agent-guide §5), so the owner decides and does it.
2. **Right after the prod deploy is live,** push all six in one go, from a checkout of `dev`/`main` linked to prod:
   ```bash
   supabase db push --linked --dry-run   # must list exactly the six files above
   supabase db push --linked
   ```
3. **The window between 1 and 2:**
   - the permissions page shows its load error;
   - walk-in keeps the old "พนักงานขาย" behaviour.

   Nothing is lost. Keep the window short.

**Option not chosen:** apply #4–#6 before the deploy and #1–#3 after. It removes the permissions-page window, but #4 sorts after #1–#3, so it needs out-of-order history and `--include-all`. That is more steps and more risk for a few minutes of one settings page.

## Verify after the push (the agent does this; read-only)

- `supabase migration list --linked`: remote shows all six.
- Dump each changed function with `pg_get_functiondef` and diff it against the file:
  - `sales_case_facts`, `sales_executive_work`, `sales_case_list`, `sales_work_queue`;
  - `sales_allowed`, `sales_default_actions`, `sales_capability_defaults`;
  - `walkin_create_lead_with_privacy`.

  Also check that none is `STABLE` where the file says otherwise (the PostgREST read-only trap).
- Check the issuer default: `select column_default from information_schema.columns where table_schema='private' and table_name='sales_issuers' and column_name='is_synthetic'` → `false`.
- **HTTP / UI on prod (owner signs in):**
  - The sale home queue loads.
  - The case list shows the stage track and the next step.
  - Settings → สิทธิ์พนักงาน loads its defaults.
  - One walk-in by an executive stores the chosen sale as "พนักงานขาย". This creates a real Lead, so only if the owner wants a live test.

## Rollback

- **Code still deployed (new) and the DB must go back:** run `scripts/ux-redesign-prod.rollback.sql` in one transaction (`supabase db query --linked -f …`). Then redeploy the previous code, because the new code calls `sales_case_facts` and `sales_capability_defaults`, which the rollback drops.
- **Only one migration misbehaves:** restore just that function's block from the rollback file. The blocks are independent, except that #1/#3 and the two list functions belong together.
- The rollback touches no data and removes the six rows from `supabase_migrations.schema_migrations`.

## Not covered here

- **The go-live purge (ADR 0062):** switch existing issuers' `is_synthetic` off and delete synthetic data. This is a separate R0 task with its own itemised list.
