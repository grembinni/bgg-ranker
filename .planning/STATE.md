---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Production Deploy
status: blocked
stopped_at: Paused 05-03-PLAN.md (BGG XML API auth blocker)
last_updated: "2026-07-18T02:49:53Z"
last_activity: 2026-07-18 -- Phase 05 paused mid-execution on 05-03 (BGG XML API now requires Bearer-token auth)
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26 after v1.0 milestone close)

**Core value:** The user can always tell which of any two games they actually prefer, and the ranking list accurately reflects that — not BGG's community scores, not gut-feel star ratings.
**Current focus:** Phase 05 — production-deploy-render

## Current Position

Phase: 05 (production-deploy-render) — PAUSED (blocked)
Plan: 3 of 3 (Task 1 complete, Task 2 partially complete, Task 3 not reached)
Status: Blocked on external BGG XML API auth change — see Blockers/Concerns
Last activity: 2026-07-18 -- Phase 05 paused mid-execution on 05-03 (BGG XML API now requires Bearer-token auth)

Progress: [██████████] Phase 1 | [██████████] Phase 2 | [██████████] Phase 3 | [██████████] Phase 3.1 | [██████████] Phase 4 | [          ] Phase 5

## Performance Metrics

**v1.0 Increment (Phase 4):**

- Plans completed: 4
- Timeline: 2026-05-25 → 2026-05-26 (2 days)
- Commits: 33 (since v0.9 close)
- Tests added: 169 total (was 162 at v0.9)

**v1.1 Increment (Phase 4.1):**

- Plans completed: 3
- Timeline: 2026-05-26 (single day)
- Tests added: 171 total (was 169 after Phase 4)
- New component: RankedGridView (168 lines) — 10×10 DnD grid, 50-game pagination, session image cache

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

Most recent decisions:

- Phase 4: lastUpset excluded from partialize (session-only; clears on reload)
- Phase 4: upsetTimer at module scope (not Zustand state — prevents serialize-to-null)
- Phase 4: PERSIST-02 guard in login(), not fetchCollection()
- Phase 4: Firebase Function routing — req.path replaces req.query['path']
- v1.0 close: Phase 5 deferred to v1.1 (app feature-complete; production hosting separate)
- Phase 4.1 Plan 02: Full-cell drag (no handle) for grid cells; safeOffset clamp prevents off-end pagination; preload incoming 50 (not 100) on page advance
- Phase 4.1 Plan 03: ComparisonView hamburger prefix on Ranked list (D-01); Grid view button wired to showRankedGrid(); RankedListView unchanged (D-03)
- [Phase 04.1.1]: Phase 04.1.1 Plan 01: Header wraps itself in max-w-6xl mx-auto px-4 pt-8 rendered from App.tsx (not per-view containers) for byte-identical header markup across all 4 views
- [Phase 04.1.1]: Phase 04.1.1 Plan 01: Hamburger state/timer pattern extracted verbatim from ComparisonView; new handleUnplayed handler follows same setMenuOpen(false)+action convention
- [Phase 04.1.1]: Phase 04.1.1 Plan 03: Five automatic view transitions (fetchCollection, continueSession, completeSyncAll, reAuthAndResume, cancelSync/401-reset) default to ranked-grid per D-10; backToComparison() unchanged per D-11
- [Phase 04.1.1]: Phase 04.1.1 Plan 02: ComparisonView header/nav removed, Skip relocated to full-height red 3rd grid column (D-06/D-07/D-08); RankedListView/RankedGridView/UnplayedListView headers removed, backToComparison selectors dropped (D-04/D-05)
- [Phase 04.1.1]: Phase 04.1.1 Plan 04: Checkpoint approved with post-verification tweak — removed session/total count text and switched header to grid-cols-3 layout for true icon-cluster centering (justify-self-start/center/end)
- [Phase 05]: 05-01: express.raw() single body parser used instead of chained express.json()+express.text() to avoid double-consuming the request stream and dropping login credentials — Prevents silent req.body loss on /login (D-07's core requirement)
- [Phase 05]: 05-01: Smoke test parses collid/objectid/rating from collection XML via regex (no XML parser dependency) to keep the script dependency-free
- [Phase 05]: 05-02: render.yaml placed at repo root (conventional Blueprint location, no conflict with existing config)
- [Phase 05]: 05-02: ALLOWED_ORIGIN wildcard with sync:false accepted (T-05-03) since SPA-proxy auth uses X-BGG-Session header, not credentialed cookies
- [Phase 05]: 05-03: render.yaml fixed mid-checkpoint (e6b1151) — removed stray `value: "*"` from the sync:false ALLOWED_ORIGIN var; Render's schema rejects an env var specifying both `value` and `sync` simultaneously
- [Phase 05]: 05-03 PAUSED — BGG XML API now requires app-registration + Bearer-token auth (~Oct 2025 rollout); collection reads 401 for all callers, confirmed independent of this repo's proxy code. Phase 5 cannot complete until a BGG API token is obtained and wired into proxy/server/server.js

### Roadmap Evolution

- Phase 4.1 (INSERTED after Phase 4, 2026-05-26): List View Cleanup — hamburger on ranked list, 10×10 thumbnail grid view with drag-and-drop, 50-game pagination, session image cache, dirty-flag validation for unplayed→ranked moves.
- Phase 4.1.1 (INSERTED after Phase 4.1, 2026-07-17, URGENT): ui cleanup

### Pending Todos

None.

### Blockers/Concerns

- **Phase 5 blocked:** BGG XML API now requires app registration + Bearer token auth (rolled out ~Oct 2025); collection reads return 401 until the proxy forwards an Authorization header from a BGG-issued token. User needs to register the app at boardgamegeek.com/using_the_xml_api to obtain a token before 05-03 can complete. Root-caused independently (401 reproduced via direct curl to boardgamegeek.com bypassing the proxy, for both the user's own account and a public well-known username; even the historically-public `xmlapi2/thing` endpoint 401s). Not a defect in `proxy/server/`, `render.yaml`, or `.env.production` — those are all correctly configured (SC-1, SC-3 satisfied). See `.planning/phases/05-production-deploy-render/05-03-SUMMARY.md` for full investigation notes.
- Phase 5: Firebase production deploy required for production use — `VITE_BGG_API_BASE` must point to live Function URL (superseded by Render pivot; note kept for history)
- Firebase 1-cookie vs 3-cookie BGG auth — write path unverified against live BGG in production; risk flagged in Phase 5 scope. Now also unverified against the new Bearer-token requirement (rating-write endpoint was never reached in the failed smoke-test run).
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
| Phase 04.1.1 P01 | 9min | 2 tasks | 3 files |
| Phase 04.1.1 P03 | 12min | 2 tasks | 2 files |
| Phase 04.1.1 P02 | 10min | 3 tasks | 5 files |
| Phase 04.1.1 P04 | 12min | 2 tasks | 2 files |
| Phase 05 P01 | 7min | 3 tasks | 6 files |
| Phase 05-production-deploy-render P02 | 1min | 3 tasks | 8 files |

## Session Continuity

Last session: 2026-07-18T02:49:53Z
Stopped at: Paused 05-03-PLAN.md — blocked on BGG XML API Bearer-token auth requirement (see Blockers/Concerns)
Resume with: Once a BGG API token has been obtained (boardgamegeek.com/using_the_xml_api), resume 05-03 at Task 2 (live smoke test), after wiring the token into `proxy/server/server.js`'s upstream requests.
