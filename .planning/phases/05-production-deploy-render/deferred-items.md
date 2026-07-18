# Deferred Items — Phase 05

Out-of-scope discoveries logged during execution (not fixed, per executor Scope Boundary rule).

## src/api/bggClient.test.ts — pre-existing unhandled promise rejection noise

**Found during:** 05-01 Task 2 verification (`npm test` full-suite run)

**Observation:** `npm test` reports `Test Files 12 passed (12)` and `Tests 217 passed (217)` (all green), but Vitest also prints 3 "Unhandled Rejection" warnings originating in `src/api/bggClient.test.ts`'s `poll202Loop` tests (`throws on non-200/202 status (COLL-01)`, `throws when response body starts with <html (COLL-01)`). These are pre-existing — the test file and `bggClient.ts` were not touched by this plan (05-01 only added `proxy/server/` files and extended `vitest.config.ts`'s `include` glob, which does not affect `src/` test execution). Verified: no test assertions fail; this is async-timing noise from a promise rejection being observed before/without an explicit `await`/`.catch()` in the test's own flow.

**Status:** Deferred — out of scope for 05-01 (unrelated file, no functional regression). Not fixed.
