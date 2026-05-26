---
phase: 04-display-polish
plan: 01
subsystem: testing
tags: [vitest, react-testing-library, tdd, zustand, red-phase]

# Dependency graph
requires:
  - phase: 03.1-sync-polish
    provides: ComparisonView.test.tsx and store.test.ts baseline with existing mocks and helper functions
provides:
  - Failing describe blocks for DISP-01 (thumbnail), DISP-02 (upset callout), D-03 (timer clear), D-07 (login auto-resume), D-08/D-09 (hamburger menu)
  - Extended vi.mock with lastUpset and logout fields
  - RED phase (Wave 0) TDD gate for all Phase 4 behaviours
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic mock variables (let) in vi.mock factory — mockLastUpset, mockCurrentPair captured by reference"
    - "afterEach vi.useRealTimers() paired with vi.useFakeTimers() in timer tests"

key-files:
  created: []
  modified:
    - src/components/ComparisonView.test.tsx
    - src/store/store.test.ts

key-decisions:
  - "RED phase established before any production code changes — all 15 new tests fail, 54 existing tests pass"
  - "mockCurrentPair added as dynamic let variable so thumbnail tests can switch currentPair to include g2 with thumbnail URL"
  - "Upset detection tests use explicit ratings (g3=900, g2=700, g1=500, g0=300) for deterministic position assertions"
  - "login auto-resume tests that verify current correct behavior (different user / empty ratings → fetch) pass at RED phase — only the new skip-fetch path fails"

patterns-established:
  - "Wave 0 TDD: extend test files with failing blocks before any implementation — subsequent plans make them green"
  - "afterEach vi.useRealTimers() cleanup pattern for timer tests using vi.useFakeTimers()"

requirements-completed:
  - DISP-01
  - DISP-02

# Metrics
duration: 15min
completed: 2026-05-25
---

# Phase 4 Plan 01: Wave 0 TDD Red Phase Summary

**Failing describe blocks for all Phase 4 behaviours (DISP-01 thumbnail, DISP-02 upset callout, D-03 timer clear, D-07 login auto-resume, D-08/D-09 hamburger menu) established before any production code is touched**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-25T16:00:00Z
- **Completed:** 2026-05-25T16:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `ComparisonView.test.tsx` mock with `lastUpset`, `logout`, `g2` game, and dynamic `mockCurrentPair` variable
- Added three new describe blocks to `ComparisonView.test.tsx`: thumbnail (3 tests), upset callout (4 tests), hamburger menu (7 tests)
- Extended `store.test.ts` with two new describe blocks: pick() upset detection (3 tests), login() auto-resume (3 tests)
- RED state confirmed: 15 new tests fail, 54 existing tests pass — correct Wave 0 exit state

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Extend both test files with Phase 4 failing describe blocks** - `24186e9` (test)

_Note: Both TDD tasks committed in a single RED-phase commit per Wave 0 convention_

## Files Created/Modified

- `src/components/ComparisonView.test.tsx` - Extended mock (lastUpset, logout, g2, dynamic currentPair); added 14 new tests across 3 describe blocks
- `src/store/store.test.ts` - Added afterEach import; added 6 new tests across 2 describe blocks

## Decisions Made

- Dynamic `mockCurrentPair` lets thumbnail tests switch which game appears (g2 with thumbnail) without re-rendering with a fixed pair
- Upset detection tests use explicit ratings g3=900/g2=700/g1=500/g0=300 so position assertions are fully deterministic
- The two `login() auto-resume` tests that verify current behavior (fetch when different user, fetch when no ratings) intentionally pass at RED phase — only the skip-fetch-for-same-user-with-data path fails, which is the net-new behavior to implement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial test run showed a misleading "Vitest failed to find the runner" error on first execution after edits; re-running cleared the error. Root cause: likely Vitest transform cache warming on first run of modified file. No code change required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 RED phase complete — 04-02 can implement `lastUpset` field in store, pick() upset detection, and 5s timer
- 04-03 can implement hamburger menu and login auto-resume
- 04-04 can implement GameCard thumbnail upgrade and callout rendering in ComparisonView
- All 54 prior tests remain green — no regression risk in test suite

---
*Phase: 04-display-polish*
*Completed: 2026-05-25*
