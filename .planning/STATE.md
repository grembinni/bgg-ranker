# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26 after v1.0 milestone close)

**Core value:** The user can always tell which of any two games they actually prefer, and the ranking list accurately reflects that — not BGG's community scores, not gut-feel star ratings.
**Current focus:** Planning v1.1 — Phase 4.1 List View Cleanup (inserted before Phase 5)

## Current Position

Phase: 4.1 (List View Cleanup) — Planned (3 plans, ready to execute)
Status: Planning complete; ready for /gsd:execute-phase 4.1
Last activity: 2026-05-26 — Phase 4.1 planned (3 plans: store extension, RankedGridView component, App+ComparisonView wiring)

Progress: [██████████] Phase 1 | [██████████] Phase 2 | [██████████] Phase 3 | [██████████] Phase 3.1 | [██████████] Phase 4 | [          ] Phase 5

## Performance Metrics

**v1.0 Increment (Phase 4):**
- Plans completed: 4
- Timeline: 2026-05-25 → 2026-05-26 (2 days)
- Commits: 33 (since v0.9 close)
- Tests added: 169 total (was 162 at v0.9)

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

Most recent decisions:
- Phase 4: lastUpset excluded from partialize (session-only; clears on reload)
- Phase 4: upsetTimer at module scope (not Zustand state — prevents serialize-to-null)
- Phase 4: PERSIST-02 guard in login(), not fetchCollection()
- Phase 4: Firebase Function routing — req.path replaces req.query['path']
- v1.0 close: Phase 5 deferred to v1.1 (app feature-complete; production hosting separate)

### Roadmap Evolution

- Phase 4.1 (INSERTED after Phase 4, 2026-05-26): List View Cleanup — hamburger on ranked list, 10×10 thumbnail grid view with drag-and-drop, 50-game pagination, session image cache, dirty-flag validation for unplayed→ranked moves.

### Pending Todos

None.

### Blockers/Concerns

- Phase 5: Firebase production deploy required for production use — `VITE_BGG_API_BASE` must point to live Function URL
- Firebase 1-cookie vs 3-cookie BGG auth — write path unverified against live BGG in production; risk flagged in Phase 5 scope
- Phase 1 VERIFICATION.md absent — RANK-06/07/08/09 code correct; doc-only gap, low priority

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Display | Full ranked list view (DISP-V2-01) | v2 | Requirements |
| Display | Tier groupings in ranked list (DISP-V2-02) | v2 | Requirements |
| Collection | Reconciliation on return visit (COLL-V2-01) | v2 | Requirements |
| Collection | Collection filtering (COLL-V2-02) | v2 | Requirements |
| Collection | Expansion toggle (COLL-02) | v2 | Phase 2 discuss-phase (2026-05-23) |
| Quality | Single-step undo (QOL-V2-01) | v2 | Requirements |
| Infrastructure | Firebase production deploy | v1.1 | v1.0 milestone close (2026-05-26) |

## Session Continuity

Last session: 2026-05-26
Stopped at: v1.0 milestone archive complete — ready to start v1.1
Resume with: `/gsd:discuss-phase 4.1` (List View Cleanup — inserted phase)
