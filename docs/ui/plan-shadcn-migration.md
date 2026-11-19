# Plan: migrate the app UI to shadcn/ui

Status: decided 2026-11-18 (ADR 0031, git-ignored; this file is the tracked copy of its decisions). Branch base: `dev`. One PR into `dev` per phase; P3 is one PR per area.

## Decisions (tracked copy of ADR 0031)

- Full migration to Tailwind v4 utilities + shadcn/ui, including `/walkin`. End state: no `*.module.css` except print documents.
- Print documents (`*-paper.*`, `src/app/sales/documents/[id]/`) stay CSS modules and never import `src/components/ui/`.
- Radix primitives. No dark mode. Look stays identical: existing token values mapped onto shadcn variables.
- `.dense` density stays. `ui/` components use `h-(--control-h)` and app text tokens, never fixed `h-9` / `h-8` / `size-9` / `text-sm` from shadcn's source.
- `NativeSelect` for short lists, Combobox (Popover + Command) for search, Radix Select only for rich options. Native `<dialog>` wrapped as `ui/dialog.tsx`. Forms: `Field` + Server Actions + zod, no `react-hook-form`.
- Composites in `src/components/` only on their second real use. Admin-only `/design-system` catalogue from P0.
- Approved dependencies: `clsx`, `tailwind-merge`, `class-variance-authority`, `radix-ui`, `tw-animate-css`, `cmdk`.
- One element, one system: never `styles.x` and utilities in the same `className`.
- No `postcss.config.*`; Tailwind stays on the `@tailwindcss/turbopack` rule in `next.config.ts`. `globals.css` merged by hand.
- Rejected: keep CSS modules only, hybrid, big-bang, Base UI, default shadcn theme, Radix Select/Dialog everywhere, react-hook-form, up-front composites, Storybook, dark mode (reasons in ADR 0031).

## Token mapping

Colours (`@theme inline`):

| shadcn variable | app token today | value |
|---|---|---|
| `--background` | `--canvas` | `#f8fafc` |
| `--foreground` | `--ink` | `#0f172a` |
| `--card`, `--popover` | `--paper` | `#fff` |
| `--primary` | `--accent` (renamed) | `#047857` |
| `--primary-foreground` | `--on-accent` | `#fff` |
| `--secondary`, `--muted`, `--accent` | `--tint` | `#f1f5f9` |
| `--muted-foreground` | `--muted` (renamed) | `#64748b` |
| `--border` | `--line` | `#e2e8f0` |
| `--input` | `--control-border` | `#7c8a9d` |
| `--ring` | `--accent` | `#047857` |
| `--destructive` | `--danger` | `#b91c1c` |
| app extras | `--brand-tv(-tint)`, `--brand-bk(-tint)`, `--warn-*`, `--danger-ink/-tint`, `--line-strong`, `--skeleton`, `--backdrop` | unchanged values, exposed as `bg-brand-tv` etc. |

Density-dependent (plain `@theme`, so `.dense` overrides still apply at runtime): `--text-xs/sm/md/lg/xl/title`, `--control-h`, `--tap-min`. Set each `--text-*--line-height` explicitly (or reset Tailwind's defaults), otherwise Tailwind's built-in line heights for `text-sm` etc. leak in and body copy shifts.

Spacing / radius: see the table in ADR 0031 (`--space-5` = `6`, `--space-6` = `8`; pill and round = `rounded-full`).

## Phases

### P0 — Foundation
1. Create `components.json` by hand or `shadcn init` with output reviewed: Radix, `src/components/ui`, `@/lib/utils`, CSS file `src/app/globals.css`. Reject any `postcss.config.*` and revert any rewrite of `globals.css`.
2. Install the approved dependencies; add `src/lib/utils.ts` (`cn`).
3. Merge `globals.css` by hand per the mapping above. Rename `--accent` → `--primary` and `--muted` → `--muted-foreground` across all module CSS (253 references), then add shadcn's `--accent` / `--muted` as tint.
4. Fonts: keep Nunito/Sarabun via `--font-body`; map `--font-sans` to it.
5. Extend `src/lib/design-tokens.check.mts`: whole-file scan of `.tsx/.ts` for raw palette utilities and arbitrary colour values (including `cn()` / `cva()` args); reject new `*.module.css` outside print + `MODULE_ALLOWLIST` (all 26 current files). Keep the existing module token rule.
6. Pin `shadcn` in `.mcp.json` to the `devDependencies` version.
7. `/design-system` route, admin only, empty sections ready for P1.

Done when: `node src/lib/design-tokens.check.mts`, `tsc`, `lint` pass; screenshots of `/walkin`, `/leads`, `/sales`, `/summary` at 1280/1024/768 are identical to before (the renames are the main risk).

### P1 — Primitives
Add and adapt to density: `button`, `input`, `textarea`, `native-select`, `combobox` built on Popover + Command (Radix + `cmdk`), not the registry item, which is Base UI; it replaces `src/app/sales/new/search-picker.tsx` and carries `name`/`required` through a hidden input, `select` (rich options only), `table`, `badge`, `field`/`label`, `checkbox`, `radio-group`, `dialog` (native wrapper), `sonner` (existing toasts), `tooltip`/`dropdown-menu`/`popover` where used. Each listed on `/design-system`.

Replace raw elements app-wide where the element's own styling is the only thing on it. Where an element also carries a layout class from a module, leave it for P2/P3 (one-system rule).

Done when: every primitive is on `/design-system` in both touch and mouse density; no `ui/` file contains fixed `h-8/9/10`, `size-8/9/10` or `md:text-*` (enforced by `design-system.check.mts`; `text-sm` is fine because our theme makes it density-aware); touch inputs render at 17px (no iOS zoom).

### P2 — Split shared stylesheets
`src/app/sales/sales.module.css` (56 importers) and `src/app/walkin/walkin.module.css` (16 importers outside `/walkin`) are component libraries in disguise. List their classes by importer count; every class used in two or more routes becomes a composite in `src/components/` (expected: panel/section, page header, field row, dialog body, status/brand pill, money text, data table). Replace usages; remove the moved classes from the two files.

Done when: no file outside `src/app/walkin/` imports `walkin.module.css`; `sales.module.css` keeps only classes used by one route; composites are on `/design-system`.

Walk-in split: shared cards, text, shell, feedback and native dialog styles are consumed from their owning components or shared utility classes. External routes no longer import `walkin.module.css`. The login, password and Lead management fields use ADR 0053 markup. The Lead list and report fields follow with the Leads P3 slice.

#### P2 field decision (tracked copy of ADR 0053, 2026-11-18)
- `.field` from `sales.module.css` (109 uses, 24 files) becomes shadcn markup: `<Field><FieldLabel htmlFor={id}>…</FieldLabel><Input id={id}/></Field>` with `Input` / `Textarea` / `NativeSelect`; no wrapper component. Layout classes move to `Field`; hidden labels use `FieldLabel className="sr-only"`.
- Ids: `useId()` where hooks are allowed (client and sync server components), `${id}-<name>` per field; async pages use fixed `<page>-<name>`; `.map()` fields append the key.
- Look: primitives as they are (darker `--input` border for WCAG 1.4.11, focus ring, regular-weight input text, auto-growing textarea), except `FieldLabel` set to `text-md font-semibold` with an 8px gap, and long-text textareas keep `min-h-[100px]`. Deliberate exception to "the look does not change".
- Slices, smallest first: (1) dashboard and summary; (2) sales settings, `/sales/new`, `evidence-upload`; (3) `sales/[id]`. Rules in other single-route modules that target `label` are retargeted to `[data-slot="field"]` in the same slice. `search-picker` → `ui/combobox` is a separate slice after these. The `.field` of `walkin.module.css`, `leads.module.css` and `report.module.css` (login, account, leads, ~15 uses) migrates with the walkin split and the `/leads` PR.
- Verify per slice: every control has an accessible name and no duplicate ids; screenshots at 1280/1024/768; submit one form per route on the local backend (password forms: no submit).
- Paper exception: `quotation-editor.tsx` and `quotation-paper-fields.tsx` (13 fields) keep label-wrapped markup because paper components do not use `ui/` (ADR 0031); their `.field` rules moved into `quotation-editor.module.css`. They follow with the paper documents in P3.
- Rejected: composite class over raw controls, label wrapping primitives without ids, fixed ids everywhere, a `<LabeledField>` wrapper, restoring the old look exactly.

### P3 — Page layouts (one PR each)
1. `/walkin` (+ real-iPad check) — layout migration prepared, real-device verification pending
2. `/leads` (incl. `[id]`, report)
3. `/sales` (case, tasks, settings, new) — largest; may split by sub-route
   Slices (one commit each, smallest first; census 2026-11-19: 14 screen modules, 54 files, `sales.module.css` still used by 11 files):
   1. `executive-dashboard.tsx` (rendered by `/dashboard`; `/sales` itself only redirects) — done
   2. `new`, `evidence-upload`, `settings` (`settings.module.css`, the `unit*` rules of `sales.module.css`)
   3. `[id]` case workspace (`workspace-section`, `bkp-*`, `document-library`, `finance-collection`, `quotation-section`, `design-billing-panel`, the rest of `sales.module.css`)
   4. `[id]/tasks` (`task-header`, `contract-wizard`, `quotation-acceptance`, `quotation-editor` with the paper exception)
   Print modules (`*-paper`, `document`) stay. `sales.module.css` is deleted with slice 3.
4. `/summary` + `/dashboard`, login, shell (`layout.tsx`, `AppShell`)

Per page: move module classes to utilities/composites, delete the module file, remove it from `MODULE_ALLOWLIST`.

### P4 — Cleanup
Delete remaining non-print modules, `--space-*`, old radius/text duplicates and the old module token rule; `MODULE_ALLOWLIST` holds only print files; update ADR 0031 status.

## Verification (every phase)
- `node src/lib/design-tokens.check.mts`, related `*.check.mts`, `tsc`, `lint`. Never `next build` while `next dev` runs.
- Before/after screenshots at 1280, 1024, 768 for every touched page; ask the developer before each browser check (Claude browser / checklist / skip). Unverified layers are named in the PR.
- PR opens as Draft until verified.

## Risks
- Density regressions on touch vs mouse; check both (`pointer: fine` vs touch emulation).
- Cascade: unlayered module CSS overrides utilities silently during P1–P3.
- Cross-route imports of the two shared stylesheets break pages that were not in the PR.
- Line-height drift from Tailwind's default `--text-*--line-height`.
