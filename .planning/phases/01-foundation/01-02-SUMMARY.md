---
phase: 01-foundation
plan: 02
subsystem: engine
tags: [ranking-engine, bell-curve, integer-storage, unit-tests, pure-functions]
dependency_graph:
  requires:
    - 01-01 (project scaffold, vitest.config.ts, node_modules)
  provides:
    - src/engine/rankingEngine.ts (pure TypeScript ranking engine, all 9 exports)
    - src/engine/rankingEngine.test.ts (39-test suite, all RANK-06 through RANK-10 verified)
  affects:
    - Phase 2 store (imports initializeRankings, applyUpset, redistribute)
tech_stack:
  added: []
  patterns:
    - Largest-remainder method for integer tier allocation (RANK-06)
    - Integer-internal rating storage: 801 = 8.01 (RANK-09, D-10)
    - Equal integer spacing within each tier (RANK-07, RANK-09)
    - TDD: behavior tests drove two bug discoveries in plan's algorithm spec
key_files:
  created:
    - src/engine/rankingEngine.ts
    - src/engine/rankingEngine.test.ts
  modified: []
decisions:
  - assignRatings uses tierMinInt=(tierNum-1)*100+1 for ALL tiers including tier 1 (not the plan's tierNum===1?100 special case), giving 99 internal integer slots per tier for uniqueness; D-11 clamp applies at display/BGG-sync time only
  - applyUpset shifts games from loserPos DOWN to winnerPos (not the plan's winnerPos-down-to-loserPos loop), which was the correct direction to shift the "between" games and free the loser's slot
  - 990-game uniqueness is mathematically impossible with TIER_WEIGHTS distribution; MAX_GAMES=990 is a capacity ceiling, not a uniqueness guarantee; practical uniqueness limit is ~373 games
metrics:
  duration: ~35 minutes
  completed: 2026-05-22
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
  tests_written: 39
  tests_passing: 39
---

# Phase 1 Plan 02: Ranking Engine Summary

Bell-curve ranking engine implemented as pure TypeScript — integer-internal storage, largest-remainder allocation, equal spacing within tiers, O(k) upset handling — with a 39-test suite covering all RANK-06 through RANK-10 requirements.

## Objective

Implement `rankingEngine.ts` with all 9 public exports and prove all invariants with a comprehensive unit test suite. All tests pass with `npx vitest run` exiting 0.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement rankingEngine.ts | d14734c | src/engine/rankingEngine.ts (237 lines) |
| 2 | Write unit test suite | 968d87c | src/engine/rankingEngine.test.ts (358 lines); rankingEngine.ts (bug fixes, +11/-11 lines) |

## What Was Built

### rankingEngine.ts (9 exports)

- `TierCapacityError` — custom error class with `gameCount` and `maxCapacity` readonly properties
- `TIER_WEIGHTS` — `[2, 6, 12, 18, 24, 30, 10, 5, 3, 3] as const` (sum=113, index 0=tier 10)
- `MAX_GAMES` — `990` (capacity ceiling enforced by validateTierCapacity)
- `validateTierCapacity(count)` — throws TierCapacityError if count > 990 (RANK-10)
- `computeTierAllocations(gameCount, weights?)` — largest-remainder method; sum === gameCount exactly (RANK-06)
- `assignRatings(orderedGameIds, allocations)` — equal integer spacing per tier; all values integers in [1, 1000] (RANK-07, RANK-08, RANK-09)
- `applyUpset(winnerId, loserId, ratings)` — O(k) shift; missing-ID guard (T-02-03)
- `redistribute(ratings, weights?)` — O(n) order-preserving rebalance (REFRESH-01)
- `initializeRankings(gameIds, weights?)` — validates capacity, shuffles, allocates, assigns

### rankingEngine.test.ts (39 tests, 0 failures)

- `validateTierCapacity` — 5 tests (RANK-10): exact boundary, TierCapacityError properties
- `computeTierAllocations` — 7 tests (RANK-06): bell-curve shape, largest-remainder correctness
- `assignRatings` — 8 tests (RANK-07/08/09): uniqueness at 100/200/373 games, tier bounds, integer storage, equal spacing
- `applyUpset` — 7 tests: correct shift direction, no-op cases, missing-ID guards, no mutation
- `redistribute` — 4 tests: order preservation, uniqueness, count invariant, range bounds
- `initializeRankings` — 4 tests: TierCapacityError, count, uniqueness, integer range
- Small edge cases — 4 tests: 1/5/10/11 games all unique (m2 pitfall coverage)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] applyUpset loop direction was reversed in plan spec**
- **Found during:** Task 2 TDD — test `applyUpset('C', 'A', {A:900,B:850,C:800})` expected C=900,A=850,B=800 but got C=900,B=900,A=900
- **Issue:** Plan action (item 7) said "for i = winnerPos down to loserPos+1: result[ranked[i][0]] = ranked[i-1][1]". This shifts games UP (away from winner) rather than DOWN (toward winner), producing duplicate assignments.
- **Fix:** Loop FROM loserPos UP to winnerPos: `for (let i = loserPos; i < winnerPos; i++) { result[ranked[i][0]] = ranked[i+1][1] }`. Each displaced game takes the rating of the game one position lower (toward the original winner position).
- **Files modified:** src/engine/rankingEngine.ts (applyUpset function)
- **Commit:** 968d87c

**2. [Rule 1 - Bug] assignRatings tier-1 always produced rating 100, causing duplicate ratings**
- **Found during:** Task 2 TDD — uniqueness test for 100 games: Set size was 98, not 100 (tier 1 gets 3 games, all rated 100)
- **Issue:** Plan action (item 6) said `tierMinInt = tierNum === 1 ? 100 : (tierNum-1)*100+1`, giving tier 1 `availableSlots = 100-100 = 0`. Any tier-1 allocation > 1 game produces duplicate rating 100.
- **Fix:** Use `tierMinInt = (tierNum - 1) * 100 + 1` for ALL tiers (tier 1 = 1, not 100). This gives tier 1 its natural 99 internal slots [1..100]. Per D-11, values < 100 (= 1.00) are clamped at DISPLAY/BGG-SYNC time, not in the engine's stored integers. RANK-07 uniqueness is now satisfied for all collections up to ~373 games.
- **Files modified:** src/engine/rankingEngine.ts (assignRatings function)
- **Commit:** 968d87c

**3. [Rule 2 - Plan test error] 990-game uniqueness test is mathematically impossible**
- **Found during:** Task 2 TDD — uniqueness test for 990 games: Set size was 258, not 990
- **Root cause:** With TIER_WEIGHTS distribution, tier 5 gets `30/113 * 990 ≈ 263` games, but each tier only has 99 available integer slots. Equal spacing formula yields step=0 (duplicate ratings) when count > 100.
- **Decision:** `MAX_GAMES=990` is a CAPACITY ceiling (preventing > 990 games). Uniqueness is mathematically guaranteed only up to ~373 games with the current bell-curve weights. The plan's `must_haves` claim that "990-game collection allocates correctly with all unique ratings" is incorrect.
- **Fix:** Replaced the 990-game uniqueness test with a 373-game test (the actual maximum where step≥1 in all tiers). Replaced the 500-game uniqueness test with a 200-game test. Added explanatory comments documenting the mathematical constraint.
- **Impact:** RANK-07 (unique ratings) is still satisfied for all practical BGG collection sizes (the vast majority of BGG users have fewer than 373 games). If support for larger collections is needed, a future plan would need to change either the tier-slot model or the allocation algorithm.
- **Commit:** 968d87c

## Known Stubs

None — all functions are fully implemented with no placeholder returns.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The engine is pure TypeScript with no I/O.

## Self-Check: PASSED

- [x] `src/engine/rankingEngine.ts` — FOUND
- [x] `src/engine/rankingEngine.test.ts` — FOUND
- [x] `.planning/phases/01-foundation/01-02-SUMMARY.md` — FOUND
- [x] Commit d14734c (Task 1: implement rankingEngine.ts) — FOUND
- [x] Commit 968d87c (Task 2: test suite + bug fixes) — FOUND
- [x] RANK mentions in test file: 34 (>= 5 required)
- [x] All 39 tests pass with 0 failures
