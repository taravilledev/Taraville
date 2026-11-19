# Multiple-project Lead cards

Owner-approved 2026-11-05; R1 implementation with ADR0031 business decision.

Confirmed facts: Taraville already has many Property Sales per Lead. BKP is blocked by projects_active_lead_idx and walkin_open_project's active-Project guard. createCase currently chooses an arbitrary first active Project. Existing project_id uniqueness on sales_cases remains intentional.

Scope: remove only the one-active-BKP restriction; preserve permissions/version/replay/close/cancel guards. Use explicit project selection through Lead card → new-case query/form → Server Action → RPC. Render compact whole-card links, code once, status, useful next step and positive outstanding only; keep status-only redaction and add Project count. Top CTA opens new work.

Checks: delegated integration regression must fail before local migration, then pass after it; include multiple open Projects, replay/stale/ownership and exact Next-action Project binding. Existing mocked Lead render checks cover card count/link/redaction. Browser verifies pointer/keyboard/375px and creates a second Project/case on an existing synthetic Lead after owner selection of verification mode. No production actions.

Local implementation and acceptance complete: migration20261105111307 applied/read back; foundation HTTP regression RED→GREEN, money suite/type/lint/render/task checks PASS. Owner-selected browser run opened a second active Project/case on the original synthetic BKP Lead, confirmed separate card navigation by pointer/keyboard and797px/375px layouts. See `.docs/SESSIONLOG-multiple-project-cards-browser-2026-11-05.md`. Production/release remains separately unapproved.
