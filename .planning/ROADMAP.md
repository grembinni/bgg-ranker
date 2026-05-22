# Roadmap: BGG Ranker

## Overview

Four phases, each delivering a complete testable capability. Phase 1 validates the CORS proxy and proves the bell-curve math. Phase 2 lets the user enter their BGG username (no password), fetch their collection, and immediately start ranking locally — no authentication required. Phase 3 adds BGG login (only needed to write ratings back) and batch sync. Phase 4 polishes the comparison screen with cover art and upset callouts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - CORS proxy validated, ranking engine proven with full unit test suite
- [ ] **Phase 2: Collection & Ranking** - User enters their BGG username, fetches their collection, and ranks games locally — no password needed
- [ ] **Phase 3: Auth & BGG Sync** - User adds their BGG password to sync rankings back to BGG
- [ ] **Phase 4: Display Polish** - Cover art and upset callouts make comparisons visually rich

## Phase Details

### Phase 1: Foundation
**Goal:** All external dependencies are validated and the bell-curve ranking engine is proven correct before any UI is built
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** RANK-06, RANK-07, RANK-08, RANK-09, RANK-10
**Success Criteria:**
  1. A manual curl or smoke-test script can fetch a BGG collection through the Vite dev proxy without a CORS error
  2. A manual curl or smoke-test script can POST credentials to BGG, receive a session cookie, and write one rating — confirming the undocumented write endpoint works end-to-end
  3. The Firebase Cloud Function is deployed and the same requests (collection read + rating write) succeed in the production environment
  4. The `rankingEngine` unit test suite passes: all computed ratings are unique, every rating falls within its tier's declared range ([N.00, (N-1).01]), spacing is equal within each tier, and the 990-game hard ceiling is enforced with a clear error
  5. Integer-internal storage is verified: ratings are stored as integers (e.g. `801` = 8.01) and no floating-point uniqueness violations occur across all tested collection sizes
**Plans:** 4 plans in 3 waves

**Wave 1**
- [x] 01-01-PLAN.md — Project scaffold: all deps installed, folder structure, minimal App.tsx, env files, Vitest config

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 01-02-PLAN.md — rankingEngine.ts implementation + full unit test suite (RANK-06 through RANK-10)
- [ ] 01-03-PLAN.md — Vite dev proxy config (/bggapi/* → BGG) + dev smoke test script

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-04-PLAN.md — Firebase Cloud Function CORS proxy + deploy + prod smoke test script

**Cross-cutting constraints:** Integer-internal storage (801 = 8.01) enforced across Plans 01-02, 01-03, 01-04; BGG write endpoint treated as [WARN] not [FAIL] across Plans 01-03, 01-04

### Phase 2: Collection & Ranking
**Goal:** User enters their BGG username (no password), fetches their owned and previously-rated games, and can immediately start ranking them locally through head-to-head comparisons — all progress persisted to localStorage
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** COLL-01, COLL-02, COLL-03, RANK-01, RANK-02, RANK-03, RANK-04, RANK-05, REFRESH-01, PERSIST-01, PERSIST-02
**Success Criteria:**
  1. User enters their BGG username (no password), and their board game collection loads (excluding expansions by default); expansion toggle adds them without re-fetching; previously rated unowned games also appear
  2. App handles the BGG 202 queued-response: if the first collection request returns 202, the app polls until 200 arrives — user sees a loading indicator, never a blank or corrupted collection
  3. On first load, games are seeded across the bell-curve tiers at random positions and the first comparison pair is presented immediately; user picks a game and the ranking updates correctly with no shared ratings
  4. Skip re-queues a pair; manual Refresh redistributes all rankings while preserving relative order and keeping all ratings unique; comparison counter updates after every pick
  5. Rankings survive page reload; if the stored username differs from the current username, stored rankings are discarded and a fresh seed is offered
  6. If the collection exceeds 990 games, the app shows a clear error before any ranking begins
**Plans:** TBD
**UI hint:** yes

### Phase 3: Auth & BGG Sync
**Goal:** User adds their BGG password to authenticate, then pushes all local rankings to BGG as star ratings — with progress feedback, resilience to interruption, and session safety
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** AUTH-01, AUTH-02, AUTH-03, SYNC-01, SYNC-02, SYNC-03
**Success Criteria:**
  1. User enters their BGG password alongside their already-known username to authenticate; a "Sync to BGG" button becomes available
  2. Sync writes all ratings to BGG one by one with live progress ("Syncing 47 / 200...") and a 200–500ms throttle between writes
  3. If sync is interrupted (page reload, session expiry), the next sync attempt resumes from the last successful write — already-synced games are not re-sent
  4. If the BGG session expires mid-sync (401), the app pauses, prompts for password re-entry, then continues from the last successful write
  5. If the user has made comparisons since the last sync and attempts to close the tab, the browser shows an "unsaved changes" warning
**Plans:** TBD
**UI hint:** yes

### Phase 4: Display Polish
**Goal:** The comparison screen shows cover art for each game and acknowledges significant ranking upsets with a callout
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** DISP-01, DISP-02
**Success Criteria:**
  1. During every head-to-head comparison, each game's BGG thumbnail (cover art) is displayed alongside its name — no placeholder or missing image for any game that has a BGG thumbnail
  2. After a user picks a winner that was previously ranked significantly lower than the loser, the app shows a callout (e.g. "Moved up 12 spots") that is visible without scrolling and clears on the next comparison
**Plans:** TBD
**UI hint:** yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/4 | Executing | - |
| 2. Collection & Ranking | 0/TBD | Not started | - |
| 3. Auth & BGG Sync | 0/TBD | Not started | - |
| 4. Display Polish | 0/TBD | Not started | - |
