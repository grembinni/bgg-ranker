# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** The user can always tell which of any two games they actually prefer, and the ranking list accurately reflects that — not BGG's community scores, not gut-feel star ratings.
**Current focus:** Phase 4 — Display Polish (Phase 3.1 complete)

## Current Position

Phase: 4 (Display Polish) — IN PROGRESS
Plan: 3 of 4 in current phase
Status: Executing — Wave 0 complete (04-01 done), Wave 1: 04-02 started, 04-03 complete
Last activity: 2026-05-25 — 04-03 GameCard thumbnail upgrade complete (DISP-01 GREEN)

Progress: [██████████] Phase 1 complete | [██████████] Phase 2 complete (3/3 plans) | [██████████] Phase 3 complete (4/4 plans) | [██████████] Phase 3.1 complete (2/2 plans) | [███████░░░] Phase 4 in progress (3/4 executed)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: ~3 min
- Total execution time: ~3 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 3.1 | 1 | 3 min | 3 min |
| 4 | 3 | ~21 min | ~7 min |

**Recent Trend:**
- Last 5 plans: 03.1-01 (~3 min), 04-01 (~15 min), 04-02 (partial), 04-03 (~6 min)
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
- Phase 3.1: Proxy fallback uses minimal `SessionID=<value>` cookie (sufficient for geekrating endpoint without full 3-cookie string)
- Phase 3.1: bggRateGame error body capped at 200 chars in console.error (dev-only, no PII)
- Phase 3.1: startSync delay fixed at 1000ms (replaces random 200-500ms for deterministic pacing)
- Phase 4.01: Wave 0 RED tests use dynamic let variables in vi.mock factory (mockLastUpset, mockCurrentPair captured by reference)
- Phase 4.01: Upset detection positions use explicit ratings for deterministic assertions (g3=900/g2=700/g1=500/g0=300)
- Phase 4.01: login auto-resume tests that verify current behavior intentionally pass at RED — only the new skip-fetch path fails
- Phase 4.03: aspect-square added to both img and placeholder div for consistent 192px square card sizing
- Phase 4.03: totalGames variable removed from GameCard (ratings selector retained for getRankPosition); rank display simplified to "#N"

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

Last session: 2026-05-25
Stopped at: 04-03-SUMMARY.md complete — DISP-01 GameCard thumbnail upgrade done, 04-02 partially complete (Task 1 committed), 04-04 is next (ComparisonView hamburger + callout)
Resume file: .planning/phases/04-display-polish/04-04-PLAN.md
