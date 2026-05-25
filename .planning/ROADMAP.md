# Roadmap: BGG Ranker

## Overview

Five phases, each delivering a complete testable capability. Phase 1 validates the dev CORS proxy and proves the bell-curve math. Phase 2 lets the user enter their BGG username (no password), fetch their collection, and immediately start ranking locally — no authentication required. Phase 3 adds BGG login (only needed to write ratings back) and batch sync. Phase 4 polishes the comparison screen with cover art and upset callouts. Phase 5 deploys the Firebase Cloud Function to production.

Phases 2–4 develop and test against the Vite dev proxy (`/bggapi/*`). All design decisions account for the Firebase production target: `VITE_BGG_API_BASE` switches proxy automatically, session tokens travel as JSON body (not Set-Cookie), and writes use `X-BGG-Session` header. Phase 5 activates production when the app is ready to ship.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Dev CORS proxy validated, ranking engine proven, Firebase Function source ready
- [ ] **Phase 2: Collection & Ranking** - User enters their BGG username, fetches their collection, and ranks games locally — no password needed
- [x] **Phase 3: Auth & BGG Sync** - User adds their BGG password to sync rankings back to BGG
- [ ] **Phase 3.1: Sync Repair** *(INSERTED)* - Fix the write path, add dirty-game tracking, 1s throttle
- [ ] **Phase 4: Display Polish** - Cover art and upset callouts make comparisons visually rich
- [ ] **Phase 5: Firebase Production Deploy** - Firebase Cloud Function deployed; app runs end-to-end in production

## Phase Details

### Phase 1: Foundation
**Goal:** Dev CORS proxy validated, bell-curve ranking engine proven correct, and Firebase Function source code ready — all before any UI is built
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** RANK-06, RANK-07, RANK-08, RANK-09, RANK-10
**Success Criteria:**
  1. A manual curl or smoke-test script can fetch a BGG collection through the Vite dev proxy without a CORS error
  2. A manual curl or smoke-test script can POST credentials to BGG, receive a session cookie, and write one rating — confirming the undocumented write endpoint works end-to-end in dev
  3. Firebase Cloud Function source code is committed and compiles cleanly; production deploy is deferred to Phase 5
  4. The `rankingEngine` unit test suite passes: all computed ratings are unique (up to 373 games), every rating falls within its tier's declared range ([N.00, (N-1).01]), spacing is equal within each tier, and the 990-game hard ceiling is enforced with a clear error
  5. Integer-internal storage is verified: ratings are stored as integers (e.g. `801` = 8.01) and no floating-point uniqueness violations occur across all tested collection sizes
**Status:** ✅ Complete
**Plans:** 3 complete + 1 source-ready (deploy deferred)

**Wave 1**
- [x] 01-01-PLAN.md — Project scaffold: all deps installed, folder structure, minimal App.tsx, env files, Vitest config

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — rankingEngine.ts implementation + full unit test suite (RANK-06 through RANK-10)
- [x] 01-03-PLAN.md — Vite dev proxy config (/bggapi/* → BGG) + dev smoke test script

**Wave 3** *(source committed; deploy deferred to Phase 5)*
- [x] 01-04-PLAN.md — Firebase Cloud Function source + firebase.json + prod smoke test (Tasks 1+3 done; Task 2 deploy → Phase 5)

**Cross-cutting constraints:** Integer-internal storage (801 = 8.01) enforced across Plans 01-02, 01-03, 01-04; BGG write endpoint treated as [WARN] not [FAIL] across Plans 01-03, 01-04

### Phase 2: Collection & Ranking
**Goal:** User enters their BGG username (no password), fetches their owned and previously-rated games, and can immediately start ranking them locally through head-to-head comparisons — all progress persisted to localStorage
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** COLL-01, COLL-03, RANK-01, RANK-02, RANK-03, RANK-04, RANK-05, REFRESH-01, PERSIST-01, PERSIST-02 (COLL-02 deferred to v2 — see CONTEXT.md D-11)
**Success Criteria:**
  1. User enters their BGG username (no password), and their board game collection loads (excluding expansions by default); expansion toggle adds them without re-fetching; previously rated unowned games also appear
  2. App handles the BGG 202 queued-response: if the first collection request returns 202, the app polls until 200 arrives — user sees a loading indicator, never a blank or corrupted collection
  3. On first load, games are seeded across the bell-curve tiers at random positions and the first comparison pair is presented immediately; user picks a game and the ranking updates correctly with no shared ratings
  4. Skip re-queues a pair; manual Refresh redistributes all rankings while preserving relative order and keeping all ratings unique; comparison counter updates after every pick
  5. Rankings survive page reload; if the stored username differs from the current username, stored rankings are discarded and a fresh seed is offered
  6. If the collection exceeds 990 games, the app shows a clear error before any ranking begins
**Plans:** 3 plans

**Wave 1**
- [x] 02-01-PLAN.md — Wave 0 test scaffolds (RED tests for bggClient + store before implementation)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Vertical slice: BGG fetch + store + UsernameEntry/Loading/Error views (user can load collection)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — Vertical slice: Comparison loop UI (pick/skip/refresh/counter, persistence)
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
**Plans:** 4 plans

**Wave 1**
- [x] 03-01-PLAN.md — Wave 0 RED test scaffolds (bggLogin, bggRateGame, store Phase 3 actions, partialize assertions)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — Core infrastructure: Vite proxy login rewrite + bggLogin + bggRateGame + store slice extensions + all sync actions

**Wave 3** *(blocked on Wave 2 completion — 03-03 and 03-04 run sequential due to App.tsx overlap)*
- [x] 03-03-PLAN.md — Auth UI slice: UsernameEntry password field + login() wiring + beforeunload guard in App.tsx
- [x] 03-04-PLAN.md — Sync UI slice: SyncingView + ComparisonView Sync button + App.tsx SyncingView branch

**Cross-cutting constraints:** Integer-internal ratings (ratingInt/100 only at bggRateGame call site) across Plans 03-02, 03-04; sessionId excluded from partialize across Plans 03-01, 03-02; UI components never call bggClient directly across Plans 03-03, 03-04

### Phase 3.1: Sync Repair *(INSERTED)*
**Goal:** Fix the "Sync to BGG" write path so ratings actually land on BGG; replace blunt full-resend logic with per-game dirty tracking
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** SYNC-01, SYNC-02, SYNC-03
**Success Criteria:**
  1. Clicking "Sync to BGG" after login successfully writes ratings to BGG (no "Sync failed" error)
  2. The Vite proxy correctly forwards write requests with a valid session even after a dev server restart
  3. After N comparisons, only the N affected games are included in the next sync — not the full collection
  4. Sync throttle is 1 second between writes
**Plans:** 2 plans

**Wave 1**
- [ ] 03.1-01-PLAN.md — Fix write path: proxy session fallback, ajax=1, error logging, 1s throttle

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 03.1-02-PLAN.md — Dirty tracking: replace syncedGameIds clearing with per-action dirtyGameIds marking

---

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

### Phase 5: Firebase Production Deploy
**Goal:** Firebase Cloud Function deployed and production CORS proxy operational — the app runs end-to-end in production with no CORS errors
**Mode:** mvp
**Depends on:** Phase 4 (app feature-complete before production deploy)
**Requirements:** *(infrastructure — no app requirements)*
**Success Criteria:**
  1. Firebase CLI authenticated and `firebase deploy --only functions` completes without error; Function URL is live at `https://us-central1-PROJECT_ID.cloudfunctions.net/bgg`
  2. `.env.production` updated with the live Function URL as `VITE_BGG_API_BASE`
  3. `smoke-test-prod.sh` exits 0 with real credentials against the live Function URL: collection read succeeds (200 after poll if needed), login returns a sessionId, write path logged as `[OK]` or `[WARN]`
  4. `npm run build` succeeds with the production env var set; deployed static files reach BGG through the Firebase Function with no CORS errors
**Plans:** 1 plan (firebase-deploy)

**Note:** Firebase Function source code (`proxy/functions/src/index.ts`), `firebase.json`, `.firebaserc`, and `scripts/smoke-test-prod.sh` are already committed from Phase 1 Plan 01-04. Phase 5 only requires the CLI deploy step and updating `.env.production`.

**Firebase design decisions already in all phases:**
- Session token travels as JSON body `{ sessionId }` from Firebase Function to SPA (D-07) — never Set-Cookie relay
- Authenticated BGG writes use `X-BGG-Session` request header (D-08) — Firebase Function reattaches as Cookie to BGG
- `VITE_BGG_API_BASE` env var switches proxy automatically: `/bggapi` in dev, Firebase Function URL in prod
- Blaze (pay-as-you-go) plan required for outbound HTTP from Firebase Functions

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | ✅ Complete | 2026-05-23 |
| 2. Collection & Ranking | 3/3 | ✅ Complete | 2026-05-23 |
| 3. Auth & BGG Sync | 4/4 | ✅ Complete | 2026-05-24 |
| 3.1. Sync Repair | 0/2 | Not started | - |
| 4. Display Polish | 0/TBD | Not started | - |
| 5. Firebase Production Deploy | 0/1 | Not started | - |
