# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** The user can always tell which of any two games they actually prefer, and the ranking list accurately reflects that — not BGG's community scores, not gut-feel star ratings.
**Current focus:** Phase 3 — Auth & BGG Sync (Phase 2 complete)

## Current Position

Phase: 3 of 5 (Auth & BGG Sync) — READY TO EXECUTE
Plan: 0 of 4 in current phase
Status: Phase 3 planned — 4 plans in 3 waves; verified; ready for execution
Last activity: 2026-05-24 — Phase 3 plan-phase complete; 03-01 through 03-04 PLAN.md written

Progress: [██████████] Phase 1 complete | [██████████] Phase 2 complete (3/3 plans) | [▒▒░░░░░░░░] Phase 3 planned (4 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: **Firebase Cloud Functions (Blaze)** chosen as production CORS proxy (replaces Cloudflare Worker; user has existing Firebase project)
- Phase 1: Session token returned in JSON body (not Set-Cookie relay); SPA stores in Zustand SessionState only
- Phase 1: Integer-internal rating storage (`801` = 8.01) to eliminate IEEE 754 precision errors
- Phase 1: BGG write endpoint (`/api/geekrating`) must be smoke-tested before sync phase is built
- Phase 1: Full tech stack installed upfront; full folder structure established in Phase 1
- Phase 2: **COLL-02 (expansion toggle) removed from v1** — boardgames only; no expansion handling in v1
- Phase 2: Username not persisted to localStorage — required every visit; embedded in PersistedRankings for PERSIST-02 guard
- Phase 2: Game cards show name + year + rank position (#47); thumbnail stored now for Phase 4 to use
- Phase 2: Single-page conditional rendering (no router); 3 views: entry → loading → comparison
- Phase 2: PERSIST-02 guard requires games populated (not just ratings) — prevents short-circuit on partial store state
- Phase 2: createAppStore return type left implicit (UseBoundStore from create()) for React hook compatibility
- Phase 2: getRankPosition defined at module scope in GameCard.tsx (avoids re-allocation per render)
- Phase 2: U+00B7 MIDDLE DOT used in combined counter format per UI-SPEC copywriting contract

### Pending Todos

None yet.

### Blockers/Concerns

- Firebase production deploy deferred to Phase 5 — all Phases 2–4 develop against Vite dev proxy; Phase 5 activates production when app is feature-complete
- BGG undocumented write endpoint (`/api/geekrating`) validation deferred to Phase 5 smoke test — dev proxy write path smoke test exists in scripts/smoke-test-dev.sh
- BGG session cookie behaviour (Max-Age vs session-scoped) — AUTH-01 should handle both; clarify during Phase 3 discuss-phase
- Uniqueness guarantee: `rankingEngine` guarantees unique ratings up to 373 games with current bell-curve weights (RANK-07 + RANK-10 conflict documented in 01-02-SUMMARY.md)

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Display | Full ranked list view (DISP-V2-01) | v2 | Requirements |
| Display | Tier groupings in ranked list (DISP-V2-02) | v2 | Requirements |
| Collection | Reconciliation on return visit (COLL-V2-01) | v2 | Requirements |
| Collection | Collection filtering (COLL-V2-02) | v2 | Requirements |
| Collection | Expansion toggle (COLL-02) | v2 | Phase 2 discuss-phase (2026-05-23) |
| Quality | Single-step undo (QOL-V2-01) | v2 | Requirements |

## Session Continuity

Last session: 2026-05-24
Stopped at: Phase 3 planning complete — 4 plans verified, ready to execute
Resume file: .planning/phases/03-auth-bgg-sync/03-02-PLAN.md (Wave 2 core infrastructure is the critical path)
