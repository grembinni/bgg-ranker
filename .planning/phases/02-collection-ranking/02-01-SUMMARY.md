---
phase: 2
plan: 01
subsystem: test-scaffolds
tags: [tdd, wave-0, red-tests, bggClient, store, vitest]
dependency_graph:
  requires: []
  provides:
    - src/api/bggClient.test.ts (Wave 0 RED tests for COLL-01 and COLL-03)
    - src/store/store.test.ts (Wave 0 RED tests for RANK-01 through RANK-05, REFRESH-01, PERSIST-01, PERSIST-02)
  affects:
    - Plans 02-02 and 02-03 (these scaffolds define the contract they must implement against)
tech_stack:
  added: []
  patterns:
    - Wave 0 TDD scaffold: tests written before implementation (RED state is success)
    - vi.mock at module top-level for Vitest hoisting of bggClient mock in store tests
    - createMockStorage() factory for node-environment persist tests (avoids jsdom)
    - selectRandomPair exported as standalone function for pure unit testing
key_files:
  created:
    - src/api/bggClient.test.ts
    - src/store/store.test.ts
  modified: []
decisions:
  - createMockStorage includes _dump() inspection method for post-pick persistence assertions
  - selectRandomPair is exported from store.ts so it can be unit-tested without store initialization
  - Store tests use vi.mock('../api/bggClient') at module level for Vitest hoist compatibility
metrics:
  duration: "~15 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 2 Plan 01: Wave 0 Test Scaffolds (Tests-First Foundation) Summary

Wave 0 RED test scaffolds for bggClient.ts and store.ts: 15 bggClient tests and 24 store tests establishing the full Phase 2 behavioral contract before any implementation code is written.

## What Was Built

### Task 1 — `src/api/bggClient.test.ts` (278 lines)

Four describe blocks covering COLL-01 and COLL-03 with 15 `it` blocks total:

- **parseCollectionXml (COLL-01)** — 5 tests: field extraction, single-item array guard (Pitfall 3), 0-game throw, name `@_value` attribute regression, yearPublished `@_value` regression
- **mergeCollections (COLL-03)** — 3 tests: owned-wins deduplication (D-13), non-duplicate append, console.debug log on duplicate
- **poll202Loop (COLL-01)** — 5 tests: immediate 200 return, 202-then-200 retry, MAX_RETRIES (8) exhaustion throws, non-200/202 HTTP error throws, HTML-200 guard throws
- **fetchCollection (COLL-01, COLL-03)** — 2 tests: T-02-01 percent-encoding mitigation, dual-query (own=1 + rated=1&own=0) issuance

### Task 2 — `src/store/store.test.ts` (527 lines)

Six describe blocks covering RANK-01 through RANK-05, REFRESH-01, PERSIST-01, PERSIST-02 with 24 `it` blocks total:

- **fetchCollection action** — 6 tests: first-load seed (RANK-01), continue-or-refetch prompt (PERSIST-02/D-10), username-mismatch discard (PERSIST-02), 991-game error without mutation (RANK-10), 0-game error without mutation (T-02-04), raw-username pass-through (T-02-01)
- **selectRandomPair** — 3 tests: null for <2 games (RANK-02), 2 distinct ids from pool, skipQueue front drain (RANK-04)
- **pick action** — 5 tests: applyUpset application (RANK-03), dual counter increment (RANK-05), skipQueue drain on next pick (RANK-04), random pool selection (RANK-02), localStorage persistence assertion (PERSIST-01)
- **skip action** — 4 tests: append to skipQueue, fresh random pair post-skip, no counter increment (RANK-05), null-pair no-op
- **refresh action** — 4 tests: redistribute called, relative order preserved, no counter increment, fresh pair selected
- **partialize / persist guard** — 2 tests: exactly 6 allowed persisted keys (PERSIST-01), exactly 7 ephemeral keys absent (AUTH-03)

## Threat Model Coverage

| Threat ID | Mitigation Test |
|-----------|----------------|
| T-02-01 | `fetchCollection` tests assert `user%20with%20spaces` in URL; store test asserts raw username passed to bggClient |
| T-02-02 | `poll202Loop` test asserts throw after 9 fetch calls matching `/timed out after 8 retries/i` |
| T-02-03 | `poll202Loop` test asserts throw on `<html...` response body |
| T-02-04 | Store `fetchCollection` test asserts `ratings.existing === 500` after 0-game throw |
| T-02-05 | PERSIST-02 discard test asserts stale ratings discarded when username differs |

## Current State

Both test files are in the expected **Wave 0 RED** state:
- `npm test -- src/api/bggClient.test.ts` → 15 tests fail with `parseCollectionXml is not a function`
- `npm test -- src/store/store.test.ts` → 24 tests fail with `createAppStore is not a function`
- `npm test -- src/engine/rankingEngine.test.ts` → 39 tests still pass (no regression)

Plans 02-02 (bggClient + store implementation) and 02-03 (UI components) will make these tests pass.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan creates test-only files. No implementation code was produced.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes were introduced. Test files only.

## Self-Check: PASSED

- `src/api/bggClient.test.ts` — FOUND (278 lines, > 180 minimum)
- `src/store/store.test.ts` — FOUND (527 lines, > 280 minimum)
- Commit `349c6a5` — FOUND (bggClient.test.ts)
- Commit `97995d9` — FOUND (store.test.ts)
- Engine tests — 39/39 PASSING (no regression)
- Both new test files — RED state confirmed (missing exports, not syntax errors)
