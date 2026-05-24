---
phase: 03-auth-bgg-sync
plan: "01"
subsystem: testing
tags:
  - tdd
  - red-phase
  - auth
  - bgg-sync
  - vitest
dependency_graph:
  requires: []
  provides:
    - "RED test contracts for bggLogin and bggRateGame in src/api/bggClient.test.ts"
    - "RED test contracts for store Phase 3 actions in src/store/store.test.ts"
  affects:
    - src/api/bggClient.ts
    - src/store/store.ts
tech_stack:
  added: []
  patterns:
    - "TDD RED phase: import non-existent exports to force compile failure"
    - "vi.mock at module level to intercept bggClient imports in store tests"
    - "URLSearchParams parsing in tests to assert form field values"
key_files:
  created: []
  modified:
    - src/api/bggClient.test.ts
    - src/store/store.test.ts
decisions:
  - "Appended to existing store.test.ts rather than replacing it — preserves 25 passing Phase 2 tests"
  - "Extended vi.mock factory to include bggLogin and bggRateGame alongside fetchCollection"
  - "2 trivially-passing store tests accepted: arithmetic predicate works with existing fields; sessionId absent because field doesn't exist yet"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 3 Plan 01: RED Tests for Auth & BGG Sync Summary

**One-liner:** TDD anchor — 27 failing RED tests define bggLogin, bggRateGame, and store Phase 3 action contracts for plans 03-02 through 03-04 to implement against.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED tests for bggLogin and bggRateGame | a36501b | src/api/bggClient.test.ts |
| 2 | RED tests for store Phase 3 actions and partialize | 38e9802 | src/store/store.test.ts |

## Test Coverage Added

### bggClient.test.ts — 10 new failing tests

**bggLogin describe block (AUTH-01) — 3 tests:**
- Resolves `{sessionId}` when fetch returns 200 with JSON body
- Throws "BGG login failed" when fetch returns 401
- Throws "no sessionId" when fetch returns 200 with empty body `{}`

**bggRateGame describe block (SYNC-01) — 7 tests:**
- Calls fetch to `BGG_API_BASE + "/api/geekrating"`
- Sends `X-BGG-Session` header equal to sessionId argument
- Converts ratingInt/100 — ratingInt=743 sends `rating="7.43"` (D-10)
- Sends `objectid=gameId` and `objecttype=thing` form fields
- Resolves void on 200 OK
- Throws with `.status===401` on 401 response
- Throws with `.status===500` on 500 response

### store.test.ts — 25 new failing + 2 trivially-passing tests

**8 new describe blocks:**
- `login action (AUTH-01)` — 3 tests: sessionId set, AUTH-03 partialize exclusion, view='loading' during login
- `startSync action (SYNC-01, SYNC-02)` — 4 tests: calls bggRateGame per game, skips syncedGameIds, increments syncProgress, sets syncStatus='session-expired' on 401
- `markGameSynced action (SYNC-03)` — 2 tests: appends to syncedGameIds, increments syncProgress
- `completeSyncAll action (SYNC-03)` — 2 tests: clears syncedGameIds, sets comparisonsAtLastSync=comparisonsTotal
- `reAuthAndResume action (AUTH-03)` — 2 tests: calls bggLogin with new password, resumes from syncedGameIds position
- `cancelSync action` — 2 tests: sets sessionId=null, does NOT clear syncedGameIds
- `beforeunload predicate (AUTH-02)` — 2 tests: comparisonsTotal > comparisonsAtLastSync after pick, equality after completeSyncAll
- `RankingsStateSlice persistence (SYNC-03)` — 2 tests: syncedGameIds+comparisonsAtLastSync in partialize, sessionId absent (belt-and-suspenders)

## Test Failure Summary (RED Confirmed)

```
Test Files  2 failed | 1 passed (3)
Tests       27 failed | 80 passed (107)
```

**bggClient.test.ts failures:** `bggLogin is not a function`, `bggRateGame is not a function` — imports not yet exported from bggClient.ts.

**store.test.ts failures:** `store.getState().login is not a function`, `store.getState().startSync is not a function`, etc. — actions not yet added to store.ts.

**Previously-passing tests:** All 78 original bggClient tests and 25 original store tests remain green (103 total — 80 pass because 2 new store tests pass trivially, 3 existing in engine).

## Deviations from Plan

### Auto-resolved: store.test.ts already existed

**Rule 3 — Blocking issue resolved automatically**
- **Found during:** Task 2
- **Issue:** Plan specified "create src/store/store.test.ts as a new file" but the file already existed with 25 passing Phase 2 tests from plan 02-02.
- **Fix:** Appended Phase 3 describe blocks to the existing file rather than replacing it. Extended the `vi.mock` factory to include `bggLogin` and `bggRateGame` alongside the existing `fetchCollection` mock. Added the new mocks to `beforeEach` resets.
- **Impact:** Zero regressions — all 25 existing tests remain green.
- **Files modified:** src/store/store.test.ts

## Threat Model Coverage

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-03-01 (sessionId in localStorage) | RED test exists in both describe blocks: `login action > sessionId is absent from partialize output` (AUTH-03); `RankingsStateSlice persistence > sessionId is absent from partialize output` |

## Stub Scan

No stubs — this plan only creates test files. No production code modified.

## Threat Flags

No new network endpoints, auth paths, or schema changes. Test files only.

## Self-Check: PASSED

- [x] `src/api/bggClient.test.ts` — file exists and contains bggLogin and bggRateGame describe blocks
- [x] `src/store/store.test.ts` — file contains all 8 Phase 3 describe blocks
- [x] Commit a36501b exists (Task 1)
- [x] Commit 38e9802 exists (Task 2)
- [x] 27 new tests fail RED; 80 existing tests remain green
- [x] No previously-passing test regressed
