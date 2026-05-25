---
phase: 03-auth-bgg-sync
fixed_at: 2026-05-25T01:51:00Z
review_path: .planning/phases/03-auth-bgg-sync/03-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-25T01:51:00Z
**Source review:** .planning/phases/03-auth-bgg-sync/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (4 Critical, 5 Warning)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: Race condition — stale sessionId read between cancellation and loop check

**Files modified:** `src/store/store.ts`
**Commit:** 9ad60bc
**Applied fix:** Added `if (!get().sessionId) return` after `await bggRateGame(...)` succeeds, before calling `markGameSynced`. This prevents phantom syncedGameIds entries when `cancelSync` fires during the await.

---

### CR-02: syncProgress reset incorrectly / startSync re-entrancy

**Files modified:** `src/store/store.ts`
**Commit:** 310a01c
**Applied fix:** Added `if (get().syncStatus === 'syncing') return` guard at the top of `startSync` to prevent concurrent invocation from double-click or stale closures.

**Note (requires human verification):** The re-entrancy guard interacted with CR-03's `reAuthAndResume` fix — see regression fix below.

---

### CR-03: reAuthAndResume crashes with non-null assertion on potentially-null sessionUsername

**Files modified:** `src/store/store.ts`
**Commit:** 04798fb
**Applied fix:** Replaced `get().sessionUsername!` non-null assertion with an explicit null check (`if (!username) { set({ syncStatus: 'error' }); return }`). Wrapped the entire `bggLogin` + `startSync` call in try/catch that sets `syncStatus: 'error'` on failure.

---

### CR-04: Vite proxy login interceptor — potential "write after end" / data corruption

**Files modified:** `vite.config.ts`
**Commit:** 7c4c52d
**Applied fix:** Added `selfHandleResponse: true` to the `/bggapi` proxy entry. This prevents `http-proxy` from auto-piping responses. Login path now drains the upstream body first (`proxyRes.resume()`) then writes the JSON response in the `end` event handler. Non-login paths now manually pipe with `proxyRes.pipe(res)` after cookie rewriting. The `cookieDomainRewrite` proxy option was removed (no longer needed; cookie header rewriting is done manually in the `proxyRes` handler).

---

### WR-01: pick action reads stale skipQueue front for nextPair but drains a different copy

**Files modified:** `src/store/store.ts`
**Commit:** 55fd8bc (then corrected in regression fix commit 31d9382)
**Applied fix:** Removed the inline `skipQueue.length > 0 ? skipQueue[0] : selectRandomPair(newRatings, [])` ternary. Now calls `selectRandomPair(newRatings, skipQueue)` with the pre-drain queue so `selectRandomPair`'s own drain logic (`if (skipQueue.length > 0) return skipQueue[0]`) handles the queue-front selection. The `newQueue` (post-drain) is still stored in state.

**Regression encountered and fixed:** The initial implementation passed `newQueue` (post-drain, empty) to `selectRandomPair`, causing a random pair to be returned instead of the queued front. Corrected in a follow-up commit to pass the original `skipQueue`.

---

### WR-02: login action silently keeps orphaned sessionId on collection-fetch failure

**Files modified:** `src/store/store.ts`
**Commit:** 4ce5f39
**Applied fix:** Added `sessionId: null` to the `catch` block's `set(...)` call in the `login` action so orphaned tokens are discarded when the login flow fails after obtaining a session token.

---

### WR-03: completeSyncAll schedules a setTimeout that fires after component unmount

**Files modified:** `src/store/store.ts`
**Commit:** d5cf88b
**Applied fix:** Added a module-level `completeSyncTimer: ReturnType<typeof setTimeout> | null = null` closure variable. `completeSyncAll` stores the timer ID and clears any previous one. `cancelSync` and `resetForNewUser` both clear the timer before updating state, preventing the deferred `view: 'comparison'` from overriding navigation the user has already taken.

---

### WR-04: SyncingView — "Resume Sync" button not disabled while re-auth is in flight

**Files modified:** `src/components/SyncingView.tsx`
**Commit:** e1ab704
**Applied fix:** Added `const [isSubmitting, setIsSubmitting] = useState(false)` and a `handleResume` async handler that sets `isSubmitting` to `true` before the `reAuthAndResume` call and back to `false` in a `finally` block. Button `disabled={isSubmitting || !reAuthPassword}` and label changes to `'Resuming…'` while in flight.

---

### WR-05: VITE_BGG_API_BASE is cast as string — silently undefined when env var unset

**Files modified:** `src/api/bggClient.ts`
**Commit:** 9f11138
**Applied fix:** Changed `import.meta.env.VITE_BGG_API_BASE as string` to `import.meta.env.VITE_BGG_API_BASE ?? ''` with explicit `: string` type annotation. Added a `if (import.meta.env.DEV && !BGG_API_BASE)` console.warn block so developers are alerted at runtime when the env var is missing in dev mode.

---

## Regression Fixes

### WR-01 + CR-02/CR-03 interaction

**Files modified:** `src/store/store.ts`
**Commit:** 31d9382

After applying all 9 fixes, 2 tests failed:

1. **WR-01 regression:** `pick` test expecting `['g2', 'g3']` as next pair when skipQueue had `[['g2', 'g3']]`. The initial implementation passed `newQueue` (already drained, empty) to `selectRandomPair`, returning a random pair. Fixed by passing the pre-drain `skipQueue` to `selectRandomPair`.

2. **CR-02/CR-03 interaction:** `reAuthAndResume` set `syncStatus: 'syncing'` before calling `startSync`, but `startSync`'s new re-entrancy guard (`if (get().syncStatus === 'syncing') return`) caused it to bail immediately. Fixed by setting `syncStatus: 'idle'` before calling `startSync` in `reAuthAndResume` so the guard allows the resumption call through. `startSync` itself sets `syncStatus: 'syncing'` as part of its startup.

All 124 tests pass after the regression fix.

---

## Verification

- **TypeScript:** `npx tsc --noEmit` — clean (0 errors)
- **Tests:** 124/124 pass (3 pre-existing unhandled rejection warnings from bggClient.test.ts — these existed before any changes and are not caused by these fixes)

---

_Fixed: 2026-05-25T01:51:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
