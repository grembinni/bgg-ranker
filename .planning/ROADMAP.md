# Roadmap: BGG Ranker

## Milestones

- ✅ **v0.9 — Core Loop** *(2026-05-25)* — Phases 1–3.1 · Core ranking, sync, persistence. See [milestones/v0.9-ROADMAP.md](milestones/v0.9-ROADMAP.md)
- ✅ **v1.0 — Full Feature Release** *(2026-05-26)* — Phase 4 · Display polish, auto-resume, Firebase routing fix. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 📋 **v1.1 — Production Deploy** — Phases 4.1 + 5 · List view cleanup, Firebase Cloud Function live

## Phases

<details>
<summary>✅ v0.9 Core Loop (Phases 1–3.1) — SHIPPED 2026-05-25</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-05-23
- [x] Phase 2: Collection & Ranking (3/3 plans) — completed 2026-05-23
- [x] Phase 3: Auth & BGG Sync (4/4 plans) — completed 2026-05-24
- [x] Phase 3.1: Sync Repair (2/2 plans) — completed 2026-05-25

</details>

<details>
<summary>✅ v1.0 Full Feature Release (Phase 4) — SHIPPED 2026-05-26</summary>

- [x] Phase 4: Display Polish (4/4 plans) — completed 2026-05-26

</details>

### 📋 v1.1 Production Deploy

- [x] Phase 4.1: List View Cleanup (INSERTED) — 3 plans
  - [x] 04.1-01-PLAN.md — Store extension: add ranked-grid view state + showRankedGrid() action + tests
  - [x] 04.1-02-PLAN.md — RankedGridView component: 10x10 grid, DnD, pagination, image preloading
  - [x] 04.1-03-PLAN.md — Wiring: App.tsx view router + ComparisonView buttons
- [x] Phase 04.1.1: UI Cleanup (INSERTED) — 4 plans (completed 2026-07-17)
  - [x] 04.1.1-01-PLAN.md — Universal Header component (hamburger + counts + vs/list/grid icons + username) + tests + App.tsx wiring (D-01..D-05)
  - [x] 04.1.1-02-PLAN.md — Remove per-view headers from all 4 views; ComparisonView cleanup — drop nav row, relocate red full-height Skip beside cards (D-04..D-09)
  - [x] 04.1.1-03-PLAN.md — Store: default 5 automatic view transitions to ranked-grid; keep backToComparison → comparison (D-10, D-11)
  - [x] 04.1.1-04-PLAN.md — Human-verify checkpoint: header parity, red Skip, grid-as-default landing

**Phase 04.1.1 Goal:** Replace the four per-view headers (ComparisonView, RankedListView, RankedGridView, UnplayedListView) with a single universal header shared across all views, clean up ComparisonView's now-redundant navigation controls, and change the app's default landing view from comparison to grid.
**Phase 04.1.1 Requirements:** (no formal REQ-IDs — inserted phase, scope defined via discuss-phase CONTEXT.md)
**Phase 04.1.1 Success Criteria:**

  1. A single universal header component renders identically across all four views (comparison, ranked-list, ranked-grid, unplayed-list) — no per-view header code remains
  2. Header shows, left to right: hamburger menu (Sync to BGG, Refresh rankings, Unplayed, Logout) · session/total comparison counts · vs/list/grid view-switch icons · username
  3. Back buttons are removed from RankedListView, RankedGridView, and UnplayedListView — navigation happens entirely through the universal header
  4. ComparisonView's "Ranked list"/"Grid view"/"Unplayed" buttons are removed; Skip button is repositioned to the right of the two game cards, styled red, full column height
  5. All automatic `view: 'comparison'` transitions in store.ts (post-login/collection-load, post-sync, post-401-reset) default to `'ranked-grid'` instead; `backToComparison()` remains available via the header's vs icon

- [ ] Phase 5: Firebase Production Deploy (1 plan)

**Phase 4.1 Goal:** The ranked list has two viewing modes — an existing simple text list (hamburger navigation) and a new 10×10 thumbnail grid view with drag-and-drop ranking. Grid shows 100 games at a time, shifts by 50, caches images for the session. Dirty flagging for unplayed→ranked game moves is verified.
**Phase 4.1 Requirements:** (no formal REQ-IDs yet — will be assigned during discuss-phase)
**Phase 4.1 Success Criteria:**

  1. Ranked List view has a hamburger menu for navigation (consistent with ComparisonView pattern)
  2. A "Grid View" button (grid icon) switches to a 10×10 thumbnail grid showing 100 ranked games
  3. Grid is responsive; "Previous 50" / "Next 50" buttons shift the viewport by 50 games
  4. Thumbnails in the grid support drag-and-drop reordering; dropped game updates ratings and marks dirty
  5. Images are cached in session memory — navigating forward and back does not re-fetch loaded thumbnails
  6. Moving an unplayed game to ranked position (via `moveUnplayedToRanked`) adds the game ID to `dirtyGameIds`

**Phase 5 Goal:** Firebase Cloud Function deployed and production CORS proxy operational — the app runs end-to-end in production with no CORS errors

**Phase 5 Success Criteria:**

1. Firebase CLI authenticated and `firebase deploy --only functions` completes; Function URL live
2. `.env.production` updated with live Function URL as `VITE_BGG_API_BASE`
3. `smoke-test-prod.sh` exits 0 with real credentials: collection read, login, write path all succeed
4. `npm run build` succeeds; static files reach BGG through Firebase Function with no CORS errors

**Note:** Firebase Function source code, `firebase.json`, `.firebaserc`, and `scripts/smoke-test-prod.sh` already committed from Phase 1. Phase 5 only requires the CLI deploy step and updating `.env.production`.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v0.9 | 4/4 | Complete | 2026-05-23 |
| 2. Collection & Ranking | v0.9 | 3/3 | Complete | 2026-05-23 |
| 3. Auth & BGG Sync | v0.9 | 4/4 | Complete | 2026-05-24 |
| 3.1. Sync Repair | v0.9 | 2/2 | Complete | 2026-05-25 |
| 4. Display Polish | v1.0 | 4/4 | Complete | 2026-05-26 |
| 4.1. List View Cleanup (INSERTED) | v1.1 | 3/3 | Verified | 2026-05-26 |
| 4.1.1. UI Cleanup (INSERTED) | v1.1 | 4/4 | Complete   | 2026-07-17 |
| 5. Firebase Deploy | v1.1 | 0/1 | Not started | — |
