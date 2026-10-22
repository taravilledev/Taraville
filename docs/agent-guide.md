# Agent working guide (for Codex or any non-Claude agent)

This is the owner's standing working agreement, carried over from the rules they use daily with Claude Code. It overrides your defaults. Where a generic skill or habit of yours conflicts with this file, this file wins.

Read order for a fresh session: `AGENTS.md` → this file → `docs/delivery/work-tracker.md` → `docs/adr/0001-retainer-rebuild-form-first.md` → `HANDOFF.md` (if present).

## 0. Language

- **Talk to the owner in Thai.**
- Code, identifiers, comments, commit messages, ADRs, and specs you hand to other tools: **English**.
- Pull requests: **ask the owner every time whether the PR should be Thai or English.**

## 1. When to stop and ask (risk tags)

Tag every task before you start.

| Tag | Meaning | What to do |
|---|---|---|
| **R0** | Irreversible: applying a migration to the production Supabase project, deleting data or files, `git push`, deploy, sending anything outside the system | **Stop. Ask for approval**, stating exactly what will happen (which table, how many rows, which files). Deleting data/files is R0 even if it looks like junk — show the list first |
| **Design fork** | A choice that is expensive to undo: data model, API contract, business rule | **Stop. Offer 2–3 options with trade-offs and your recommendation and why.** Wait for the owner's decision. After it is decided, write an ADR that also records the options not chosen |
| **R1** | Expensive but reversible: cross-file refactor, dependency change | Do it; give the reason briefly in your report. New dependency: ask first |
| **R2** | Easy and reversible: bug fix, new file, a migration *file* that is not applied | Just do it, report afterwards |

- **No magic.** Never assume a file, function, route, or column exists. Open it or query it.
- **No scope creep.** Do what was asked. If you see something worth fixing, report it; do not fix it.
- Give an opinion, not just a list of options. If you think the requested approach is bad, say so; if the owner insists, then do it fully.
- A bug or failure: find the root cause first (reproduce → trace the failing path → try to falsify your hypothesis). No root cause, no fix. Then tag the size of the fix.

## 2. Design forks — how to grill

For a design fork, do not just pick. Ask the owner one round of numbered questions covering the whole open frontier:
- each question has your **recommended answer** next to it;
- the root question offers 2–3 approaches with trade-offs;
- look up facts yourself (code, docs, DB) instead of asking the owner;
- a big task is split into sub-projects first; do not ask detail questions about unsplit work;
- the round ends when nothing is silently assumed.

Do not write files or commit during the grilling itself.

## 3. Keep it simple ("ponytail")

Take the first rung of this ladder that works:
1. Does it need to exist at all? (YAGNI; say so in one line if skipping)
2. Standard library does it?
3. Native platform/browser/DB feature does it (DB constraint over app code)?
4. Already-installed dependency does it?
5. One line?
6. Only then: the minimum new code, placed where the invariant belongs.

- No unrequested abstractions, no interface with one implementation, no config for a value that never changes, no scaffolding "for later".
- Deliberate simplification gets a comment: `// ponytail: <reason> — <upgrade path>`.
- **Never simplify away:** validation at trust boundaries, authorization, error handling that prevents data loss, security, accessibility basics, migration/rollback safety, concurrency protection, or anything explicitly requested.
- Non-trivial logic (a branch, loop, parser, money or security path) leaves **one runnable check** behind — the smallest thing that fails if the logic breaks.

## 4. What "done" means

Verify at **the layer the user uses**, not the most convenient layer.

- Changed SQL/RPC → hit it through the real HTTP endpoint, not only a direct DB call.
- Changed UI → open it in a browser. `tsc`, `lint`, `build` passing only means it compiles.
- **Say exactly which layers were not tested.** Never write a blanket "verified". Example: "tested at SQL level; not tested over HTTP because it is not deployed".
- Report honestly: failing tests with their output, skipped steps as skipped, finished work plainly.
- **Ask the owner before any browser-based test, every time, at the point where you would call the work done** (not while debugging mid-implementation). Offer: (1) you run it in a browser tool, (2) you give a checklist of steps + expected results for the owner to run, (3) skip. Choosing (2) or (3) means the work is **unverified**; any PR must then be opened as a **Draft**, and you never mark a PR ready yourself.

### Tests in this repo
- Business-rule logic is checked with plain `node:assert` files named `*.check.mts`, run with `node <file>.check.mts`. **There is deliberately no test runner. Do not add one.** Check `package.json` before assuming `npm test` exists — it does not.
- Trivial one-liners need no check. A non-trivial rule leaves one runnable check.

## 5. Git

- **Commit/push only when the owner asks.** On the main branch, create a branch first. Do not stage files you did not change for this task.
- **Never** add `Co-Authored-By` lines, and never mention AI tools (Claude, Codex, ...) anywhere in commits or PRs.
- Never write "tests pass" if you did not run them.
- Commit format: `<type>(scope?): <imperative summary>`; types `feat fix refactor test docs chore build ci perf`. Subject says *what*, ≤ 72 characters. Body says *why*, only when there is a breaking change, a non-obvious decision (e.g. why `DROP` before `CREATE OR REPLACE`), or a reason not visible in the diff. Design reasoning belongs in an ADR, not the commit body.
- PR (after asking Thai/English). Sections: Description (what and why, ticket) · Changes (real checklist) · Implementation (options weighed, skip if nothing debatable) · Verification (commands actually run + results, **and what was not tested and why**) · How to Test (steps for the reviewer — different from Verification, do not merge them) · Impact & Risks (regression, migration, compatibility, security, performance) · Screenshots (only if UI changed). A tiny PR (one file, no migration, no UI) needs only Description + Verification.
- Release/versioning (`dev → main`, tags) is **not defined for this repo yet**; do not invent one. Ask the owner.

## 6. Where documentation goes

| Where | Answers | When |
|---|---|---|
| `docs/adr/NNNN-*.md` | "Why this choice?" | every decided design fork, including rejected options |
| `docs/<domain>/plan-*.md` | "What is left to do?" | multi-phase work; readable standalone; include a "confirmed facts — do not re-derive" section |
| `.docs/SESSIONLOG-<topic>-<date>.md` | "What happened today?" | **end of every session that touched code**; a new file each time, never append |
| `docs/delivery/work-tracker.md` | "What is the status of each feature?" | update whenever a feature changes state |

If something needs a decision the ADRs cannot answer yet, mark it `DECISION PENDING` in the plan and continue on the recommended path.

## 7. Code conventions (frontend)

- camelCase variables/functions · PascalCase components/types · kebab-case files · SCREAMING_SNAKE constants · booleans start with `is/has/should/can`.
- Files ≤ 300 lines. No `any`. No dead code and no commented-out code.
- Server Component by default; `'use client'` only on leaf components; mutations through Server Actions; validate every Server Action input with `zod`.
- New code must read like the code around it (comment density, naming, idiom).
- Never show raw backend/DB errors in the UI. Destructive actions need a confirm step.
- No new dependency if a few lines do it. If one is truly needed, ask first.
- ESLint forbids synchronous `setState` in a `useEffect` body, including through async callees — use a promise chain and call `setState` in `.then()`.
- If the shape of a draft stored in `localStorage` changes, bump the storage key version, or old drafts crash on rehydrate.
- **Next.js here is newer than your training data.** Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code.

## 8. Supabase / Postgres traps already hit in this owner's projects

- `CREATE OR REPLACE FUNCTION` with a changed parameter list creates an overload and makes existing calls ambiguous → `DROP FUNCTION IF EXISTS <old signature>` first, always.
- New-format `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`) is not a JWT. The Storage API needs header `apikey`, not `Authorization: Bearer` (otherwise `Invalid Compact JWS`).
- `DISTINCT ON` without `ORDER BY`, and `jsonb_agg(ORDER BY x)` with duplicate `x`, are non-deterministic.
- Tenant/brand isolation is done **inside the RPC**; every new plpgsql function must filter tenant itself.
- After applying a migration, dump the function source/schema back and diff it against the file.
- The frontend calls the *deployed* backend, not local code: a backend change is invisible through the UI until it is deployed.
- Never build (`next build`) while `next dev` is running — the build overwrites the `.next` directory the dev server uses. Stop dev first.

## 9. Session handoff

When ending a session: write the SESSIONLOG (§6), update the work tracker, and if the work will continue elsewhere, write `HANDOFF.md` at the repo root (scratch file, not committed): goal, current state, files in play, what was tried and **why it failed**, current best theory, ordered next steps with exact paths/commands, constraints. Reference ADRs/plans by path instead of copying them. Redact secrets and personal data.
