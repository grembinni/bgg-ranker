---
phase: 04-display-polish
plan: 02
subsystem: store
tags: [zustand, store, upset-detection, login-auto-resume, logout, tdd, green-phase]

# Dependency graph
requires:
  - phase: 04-01
    provides: Failing RED tests for pick() upset detection (D-01, D-02, D-03) and login() auto-resume (D-07)
provides:
  - lastUpset field in ComparisonStateSlice with 5s timer auto-clear (D-03)
  - upset detection in pick() using pre-upset position ranking (D-01, D-02)
  - login() PERSIST-02 auto-resume check — skips fetchCollection for same-user-with-data (D-07)
  - logout() action — clears session fields, preserves rankings (D-08)
  - fetchCollection() PERSIST-02 guard removed — always proceeds to fetch
affects: [04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level upsetTimer (mirrors completeSyncTimer) — declared outside store, cancel-before-set pattern"
    - "Pre-upset position ranking: Object.entries(ratings).sort() BEFORE applyUpset() call"
    - "login() PERSIST-02 guard: check rankingsUsername+ratings+games AFTER set(sessionId) BEFORE fetchCollection"
    - "logout() calls cancelSync() first (idempotent) then clears sessionId/sessionUsername/view"

key-files:
  created: []
  modified:
    - src/store/store.ts
    - src/store/store.test.ts

key-decisions:
  - "upsetTimer is module-level (not React state, not Zustand state) to prevent serialize-to-null in persist and timer leaks"
  - "Pre-upset positions computed BEFORE applyUpset() — computing AFTER gives wrong positions (Pitfall 2)"
  - "PERSIST-02 guard moved entirely from fetchCollection() to login() — fetchCollection now always fetches"
  - "fetchCollection PERSIST-02 test updated to test new always-fetch behavior"
  - "logout() calls cancelSync() not resetForNewUser() — preserves rankings per D-08"

# Metrics
duration: 9min
completed: 2026-05-25
---

# Phase 4 Plan 02: Store Extension Summary

**Zustand store extended with lastUpset field, pick() upset detection with 5s timer, login() auto-resume for returning users, and new logout() action — all Phase 4 store tests turn GREEN**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-25T16:02:00Z
- **Completed:** 2026-05-25T16:11:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: Interface and module-level additions

- Added `lastUpset: { winnerName: string; spotsGained: number } | null` to `ComparisonStateSlice` interface (D-03)
- Added `lastUpset: null` to initial state
- Added `upsetTimer: ReturnType<typeof setTimeout> | null = null` module-level variable after `completeSyncTimer`
- Added `logout(): void` to `AppActions` interface

### Task 2: Action implementations

- **pick()**: Added pre-upset position computation (`ranked` sorted array BEFORE `applyUpset()`) to avoid Pitfall 2. Detects upset when `winnerPos > loserPos`, sets `lastUpset` with `winnerName` and `spotsGained`. Cancels previous `upsetTimer` before setting new 5s timer (Pitfall 1). Includes `lastUpset: newLastUpset` in the `set()` call — `null` for non-upset picks.
- **resetForNewUser()**: Added `upsetTimer` cancellation alongside existing `completeSyncTimer` cancellation.
- **login()**: Now sets `sessionUsername: username` on login success. Added PERSIST-02 auto-resume check after `bggLogin()`: if `rankingsUsername === username AND ratings non-empty AND games non-empty`, calls `continueSession()` directly instead of `fetchCollection()` (D-07).
- **fetchCollection()**: Removed PERSIST-02 early-return guard (the "Continue session?" redirect). `fetchCollection` now always proceeds to fetch — the guard's purpose now lives exclusively in `login()` (Pitfall 3 resolved).
- **logout()** (new action): Calls `cancelSync()` first (idempotent — aborts in-flight sync by nulling `sessionId`), then clears `sessionId`, `sessionUsername`, and sets `view: 'entry'`. Does NOT touch `ratings`, `games`, `rankingsUsername`, or `dirtyGameIds` (D-08 — ranking data preserved for re-login auto-resume).
- **store.test.ts**: Updated the `fetchCollection` PERSIST-02 test to reflect the new always-fetch behavior.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add lastUpset to interface, upsetTimer, logout to AppActions | aa652d3 | src/store/store.ts |
| 2 | Extend pick(), login(), fetchCollection(); add logout() | 6268320 | src/store/store.ts, src/store/store.test.ts |

## Files Created/Modified

- `src/store/store.ts` — ComparisonStateSlice: +lastUpset field; AppActions: +logout; initial state: +lastUpset:null; upsetTimer module var; extended pick()/login()/resetForNewUser(); removed fetchCollection PERSIST-02 guard; new logout() action
- `src/store/store.test.ts` — Updated fetchCollection PERSIST-02 test to match new always-fetch behavior

## Decisions Made

- **Module-level `upsetTimer`**: Matches `completeSyncTimer` pattern exactly. Timer handles must NOT live in React state (re-render side effects) or Zustand state (persist serializes to null).
- **Pre-upset position order**: The `ranked` array must be constructed from the CURRENT `ratings` BEFORE calling `applyUpset()`. Computing it after would give wrong positions because `applyUpset` swaps the entries.
- **fetchCollection guard removal**: The PERSIST-02 "Continue session?" prompt was a relic of the old entry flow. With D-07 auto-resume now in `login()`, the guard in `fetchCollection` became dead code that actually caused Pitfall 3 (returning user would see the entry screen after logging in). Removing it is correct.
- **logout() does not clear rankings**: Intentional per D-08. The re-login with the same username will auto-resume via the new PERSIST-02 check in `login()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Updated test] Updated fetchCollection PERSIST-02 test to reflect architecture change**
- **Found during:** Task 2 verification
- **Issue:** Existing test `shows continue-or-refetch prompt when rankingsUsername matches entered username and ratings exist` expected `fetchCollection` to NOT call `mockBggFetch` and to set `view: 'entry'`. This tested the OLD guard behavior that the plan explicitly removes.
- **Fix:** Updated the test to assert the NEW always-fetch behavior — `fetchCollection` now always calls `mockBggFetch` and sets `view: 'comparison'` on success.
- **Files modified:** `src/store/store.test.ts`
- **Commit:** 6268320

## TDD Gate Compliance

Wave 1 GREEN phase:
- RED gate commit: `24186e9` (test(04-01)) — established by 04-01
- GREEN gate commit: `6268320` (feat(04-02)) — this plan

All 49 `store.test.ts` tests pass including:
- `pick() upset detection (D-01, D-02, D-03)` — 3 tests GREEN
- `login() auto-resume (D-07)` — 3 tests GREEN
- All 43 previously-passing tests remain GREEN

## Known Stubs

None — all behavior is fully implemented. `lastUpset` is wired from `pick()` through the store to the state layer; the timer auto-clears after 5 seconds. `login()` auto-resume is functional.

## Next Phase Readiness

- 04-03 can implement hamburger menu in `ComparisonView.tsx` and entry form changes in `UsernameEntry.tsx` — `logout()` action is ready to wire up
- 04-04 can implement GameCard thumbnail upgrade and upset callout rendering in `ComparisonView.tsx` — `lastUpset` state is ready to read

## Self-Check: PASSED

- src/store/store.ts: FOUND
- src/store/store.test.ts: FOUND
- .planning/phases/04-display-polish/04-02-SUMMARY.md: FOUND
- Commit aa652d3 (Task 1): FOUND
- Commit 6268320 (Task 2): FOUND
- lastUpset type in ComparisonStateSlice: FOUND
- logout(): void in AppActions: FOUND
- upsetTimer module variable: FOUND
- upset detection (winnerPos > loserPos): FOUND
- PERSIST-02 guard in login(): FOUND
- lastUpset absent from partialize: CONFIRMED

---
*Phase: 04-display-polish*
*Completed: 2026-05-25*
