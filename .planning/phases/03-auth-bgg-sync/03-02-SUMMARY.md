---
phase: 03-auth-bgg-sync
plan: "02"
subsystem: api-client, store
tags:
  - tdd
  - green-phase
  - auth
  - bgg-sync
  - vite-proxy
  - zustand
dependency_graph:
  requires:
    - "03-01 RED tests for bggLogin, bggRateGame, store Phase 3 actions"
  provides:
    - "bggLogin export in src/api/bggClient.ts"
    - "bggRateGame export in src/api/bggClient.ts"
    - "Vite proxy login response rewrite — {sessionId} JSON body from Set-Cookie"
    - "Store Phase 3 slice fields: sessionId, syncedGameIds, comparisonsAtLastSync, syncStatus, syncProgress, syncTotal"
    - "Store Phase 3 actions: login, startSync, markGameSynced, completeSyncAll, reAuthAndResume, cancelSync"
  affects:
    - vite.config.ts
    - src/api/bggClient.ts
    - src/store/store.ts
tech_stack:
  added: []
  patterns:
    - "Vite proxy proxyRes intercept: buffer-free body rewrite via proxyRes.resume() + res.writeHead()"
    - "Integer-internal rating conversion: ratingInt/100 only at bggRateGame call site (D-10)"
    - "Per-iteration sessionId check in async loop for cooperative cancellation (Pitfall 4)"
    - "AUTH-03 partialize allowlist: sessionId excluded; syncedGameIds + comparisonsAtLastSync included"
    - "Private delay helper defined in store.ts (not imported from bggClient) to keep module boundary clean"
key_files:
  created: []
  modified:
    - vite.config.ts
    - src/api/bggClient.ts
    - src/store/store.ts
decisions:
  - "Vite proxy rewrites /login/api/v1 response body in proxyRes handler using proxyRes.resume() to consume upstream body, then res.writeHead + res.end with JSON — avoids pipe conflict"
  - "delay() defined as a private helper in store.ts rather than imported from bggClient — keeps module boundary clean per plan note"
  - "startSync sets syncStatus='syncing' (not 'idle') at entry; syncProgress initialized to syncedGameIds.length (number already done) so partial-resume progress is accurate"
  - "completeSyncAll uses setTimeout 2000ms for auto-return to comparison view (D-07)"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 3 Plan 02: Core Infrastructure Summary

**One-liner:** Vite proxy rewrites /login/api/v1 to JSON body; bggLogin and bggRateGame implement the BGG write path; store extends with sessionId, syncedGameIds, comparisonsAtLastSync, and 6 new sync actions — turning all 27 RED tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Vite proxy login rewrite + bggLogin + bggRateGame | b5dac83 | vite.config.ts, src/api/bggClient.ts |
| 2 | Store Phase 3 slice extensions and actions | a1b715d | src/store/store.ts |

## What Was Built

### Task 1: Vite proxy + bggClient

**vite.config.ts** — Extended the existing `proxyRes` handler to intercept `/login/api/v1` responses:
- Extracts `sessionid` from `Set-Cookie` header (same pattern as Firebase Function in `proxy/functions/src/index.ts`)
- Calls `proxyRes.resume()` to consume the upstream body, then writes a fresh `{sessionId:"..."}` JSON response via `res.writeHead + res.end`
- Non-login responses continue to receive the existing Secure-flag strip logic
- Resolves Pattern 6 (dev/prod discrepancy): `bggLogin()` now receives JSON body in both dev and prod

**src/api/bggClient.ts** — Added two new exports:
- `bggLogin(username, password)` — POST to `/login/api/v1` with `{credentials:{username,password}}` JSON body; throws on non-2xx or missing sessionId; reads sessionId from JSON body (proxy normalises dev response)
- `bggRateGame(gameId, ratingInt, sessionId)` — POST to `/api/geekrating` with URLSearchParams body and `X-BGG-Session` header; `ratingInt/100` conversion at call site only (D-10); throws `Object.assign(error, {status})` for caller 401 detection (D-18)

### Task 2: Store Phase 3 extensions

**src/store/store.ts** — Extended without restructuring:
- `SessionStateSlice` + `sessionId: string | null` (ephemeral, excluded from partialize)
- `RankingsStateSlice` + `syncedGameIds: string[]`, `comparisonsAtLastSync: number` (both persisted)
- `ComparisonStateSlice` + `'syncing'` view, `syncStatus`, `syncProgress`, `syncTotal`
- `AppActions` + 6 new actions
- Private `delay()` helper (mirrors `bggClient.ts` version; not imported to preserve module boundary)
- `partialize` extended with `syncedGameIds` and `comparisonsAtLastSync`; `sessionId` deliberately excluded (AUTH-03, T-03-01)

**Phase 3 action implementations:**
- `login` — sets view='loading', calls bggLogin, stores sessionId, then calls existing fetchCollection action
- `startSync` — iterates unsynced games, reads sessionId per iteration for abort, calls bggRateGame, detects 401 vs other errors, delays 200-500ms between writes (SYNC-02, T-03-05)
- `markGameSynced` — appends to syncedGameIds, increments syncProgress
- `completeSyncAll` — clears syncedGameIds, sets comparisonsAtLastSync=comparisonsTotal, auto-returns to comparison after 2s
- `reAuthAndResume` — re-calls bggLogin, sets new sessionId, resumes startSync (D-10)
- `cancelSync` — sets sessionId=null (loop abort signal), preserves syncedGameIds (Q2 resolution), resets view to comparison

## Test Results

```
Test Files  3 passed (3)
     Tests  107 passed (107)
```

All 27 previously-RED Phase 3 tests are now GREEN. All 80 pre-existing tests remain green.

The 3 "Unhandled Errors" in the output are pre-existing (bggClient.test.ts poll202Loop tests where intentional throws bubble as unhandled async rejections) — they were present before Plan 02 and do not correspond to any failing test case.

## Deviations from Plan

### Auto-resolved: proxyRes handler body rewrite approach

**Rule 1 — Bug Fix**
- **Found during:** Task 1 implementation
- **Issue:** The plan specified "collect data chunks from proxyRes then write new body via res.end()" but Vite's node-http-proxy sends the response body through the proxy pipeline automatically. Collecting chunks and calling `res.end()` without first calling `res.writeHead()` would produce malformed HTTP. Additionally, if we `pipe()` or collected chunks while also calling `res.end()`, we'd get a double-write error.
- **Fix:** Used `proxyRes.resume()` to discard the upstream body (preventing socket hang), then called `res.writeHead(statusCode, headers)` + `res.end(body)` on the `ServerResponse` directly. This is the correct pattern for intercepting and replacing a proxy response body.
- **Files modified:** vite.config.ts
- **Commit:** b5dac83

None. Plan executed as specified. The proxyRes approach was refined during implementation but produced the exact required behaviour (all bggLogin tests pass).

## Threat Model Coverage

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-03-01 (sessionId in localStorage) | MITIGATED — partialize allowlist does not include sessionId; verified by store.test.ts RED test that is now GREEN |
| T-03-02 (Vite proxy response rewrite) | MITIGATED — proxyRes handler intercepts login responses, extracts sessionid from Set-Cookie, returns JSON body; upstream Set-Cookie never forwarded to browser |
| T-03-03 (bggRateGame X-BGG-Session sourced from store) | MITIGATED — sessionId stored only in Zustand SessionStateSlice; bggRateGame receives it as parameter |
| T-03-05 (sync loop throttling) | MITIGATED — delay(200 + Math.floor(Math.random() * 300)) between every bggRateGame call in startSync |

## Stub Scan

No stubs — this plan implements the full data layer (API client + store). No hardcoded empty values, placeholder text, or unwired data sources. Phase 3 UI components (SyncingView, UsernameEntry update, ComparisonView sync button) are implemented in Plans 03-03 and 03-04.

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers.

## Self-Check: PASSED

- [x] `vite.config.ts` — exists and contains proxyRes intercept for `/login/api/v1` with `sessionId` extraction
- [x] `src/api/bggClient.ts` — exports `bggLogin` and `bggRateGame`
- [x] `src/store/store.ts` — contains `sessionId`, `syncedGameIds`, `comparisonsAtLastSync`, `syncStatus`, `syncProgress`, `syncTotal` fields and all 6 Phase 3 actions
- [x] `partialize` includes `syncedGameIds` and `comparisonsAtLastSync`; does NOT include `sessionId`
- [x] Commit b5dac83 exists (Task 1)
- [x] Commit a1b715d exists (Task 2)
- [x] All 107 tests pass; 0 test failures
- [x] `npx tsc --noEmit` exits 0
