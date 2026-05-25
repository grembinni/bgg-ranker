---
phase: 03-auth-bgg-sync
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - vite.config.ts
  - src/api/bggClient.ts
  - src/store/store.ts
  - src/components/UsernameEntry.tsx
  - src/App.tsx
  - src/components/SyncingView.tsx
  - src/components/ComparisonView.tsx
  - vitest.config.ts
  - package.json
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 3 adds BGG authentication (username + password → sessionId), rating write-back via the undocumented `/api/geekrating` endpoint, a sync loop with cooperative cancellation, and a re-auth flow for mid-sync session expiry. The core security requirement — sessionId never persisted to localStorage — is correctly implemented via the `partialize` exclusion in the Zustand store.

However, four blockers were found: a race condition / TOCTOU in the sync loop that allows a stale session token to be read after cancellation has already fired; incorrect `syncProgress` after re-auth causing the UI counter to jump backwards; a reachable crash when `reAuthAndResume` is called and `sessionUsername` is null; and a vite proxy response-interception bug where the upstream body is consumed asynchronously after `res.end()` may already have been called, resulting in a potential "write after end" socket error in Node's http server.

---

## Critical Issues

### CR-01: Race condition — stale `sessionId` read between cancellation and loop check

**File:** `src/store/store.ts:373-389`

**Issue:** `startSync` reads `get().sessionId` at the top of each loop iteration (line 373), then calls `await bggRateGame(gameId, get().ratings[gameId], currentSessionId)` (line 377) using the captured value. If `cancelSync()` fires during that `await`, it sets `sessionId = null` in the store. When `bggRateGame` eventually returns successfully, `get().markGameSynced(gameId)` is still called (line 378) — writing a game ID into `syncedGameIds` even though the user has already cancelled and the view has returned to `'comparison'`. On the next sync start (or re-auth resume) these phantom entries skew the resume anchor.

The cooperating check at the top of the loop only guards entry into each iteration, not the completion of a write that was already in flight.

**Fix:**
```typescript
await bggRateGame(gameId, get().ratings[gameId], currentSessionId)
// Re-check after the async write — user may have cancelled while awaiting
if (!get().sessionId) return
get().markGameSynced(gameId)
```

---

### CR-02: `syncProgress` reset incorrectly after re-auth resumes

**File:** `src/store/store.ts:357-370`

**Issue:** `startSync` sets `syncProgress: syncedGameIds.length` on line 367. This is correct on a first call. However, `reAuthAndResume` calls `startSync` after a mid-sync session expiry. At that point `syncedGameIds` contains all games already written in the first leg, so `syncProgress` is reset to that earlier value, which is correct. But `syncTotal` is also reset to `allIds.length` — which is fine. The real problem is that `syncProgress` is set to `syncedGameIds.length` at the start of `startSync`, but `markGameSynced` later increments it from that base. If the user cancels (setting `sessionId=null` but preserving `syncedGameIds`) and then calls `startSync` directly without re-auth, the progress counter is reset to the already-synced count, which would display as a backwards jump in the UI. More critically, because `cancelSync` does NOT clear `view` to prevent a stale 'syncing' view from being re-entered directly, a race where `startSync` is called twice concurrently (e.g., button double-click or a stale closure) would run two loops against overlapping `toSync` arrays, double-writing ratings to BGG.

**Fix:** Guard `startSync` against concurrent invocation:
```typescript
async startSync(): Promise<void> {
  if (get().syncStatus === 'syncing') return  // guard re-entrancy
  // ... rest of implementation
}
```

---

### CR-03: `reAuthAndResume` crashes with non-null assertion on potentially-null `sessionUsername`

**File:** `src/store/store.ts:418`

**Issue:** `reAuthAndResume` calls `bggLogin(get().sessionUsername!, password)`. The `!` non-null assertion is used here but `sessionUsername` is `string | null`. If the user opens the app fresh (session not set), navigates to the syncing view via a back/forward browser navigation or a manually crafted URL state, and the session-expired prompt appears, calling `reAuthAndResume` will pass `null` to `bggLogin` as the username argument. `bggLogin` will then POST `{"credentials":{"username":null,"password":"..."}}` to BGG, which will return a non-2xx, and the thrown error from `bggLogin` is NOT caught inside `reAuthAndResume` — it propagates up to the React event handler in `SyncingView`, which has no error boundary, resulting in an unhandled promise rejection and a blank screen.

**Fix:**
```typescript
async reAuthAndResume(password: string): Promise<void> {
  const username = get().sessionUsername
  if (!username) {
    set({ syncStatus: 'error' })
    return
  }
  try {
    const result = await bggLogin(username, password)
    set({ sessionId: result.sessionId, syncStatus: 'syncing' })
    await get().startSync()
  } catch {
    set({ syncStatus: 'error' })
  }
},
```

---

### CR-04: Vite proxy login interceptor — potential "write after end" / data corruption

**File:** `vite.config.ts:37-47`

**Issue:** The `proxyRes` event handler calls `res.writeHead(...)` (line 37), then `proxyRes.resume()` to drain the upstream body (line 43), and wires `res.end(body)` inside `proxyRes.on('end', ...)` (lines 44-46). The problem is that `http-proxy` (used by Vite's dev server) may have already started writing bytes to `res` before the `proxyRes` event fires — specifically, `http-proxy` writes the status line and headers in the same tick as it emits `proxyRes`. Calling `res.writeHead(...)` after `http-proxy` has already called `res.writeHead` internally will throw `Error: Cannot set headers after they are sent`. Additionally, if the upstream BGG login endpoint streams its response body incrementally, there is a window between `proxyRes.resume()` and the `end` event where `http-proxy` may try to pipe buffered data to `res`, corrupting the JSON response.

The correct approach is to destroy the proxy response immediately and write the new response synchronously, or use `selfHandleResponse: true` on the proxy to prevent `http-proxy` from forwarding anything automatically.

**Fix:**
```typescript
'/bggapi': {
  target: 'https://boardgamegeek.com',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/bggapi/, ''),
  selfHandleResponse: true,  // prevents http-proxy from piping to res automatically
  configure: (proxy) => {
    proxy.on('proxyRes', (proxyRes, req, res) => {
      if (req.url?.includes('/login/api/v1')) {
        const cookies = proxyRes.headers['set-cookie'] ?? []
        const sessionCookie = cookies.find((c) => c.startsWith('sessionid='))
        const sessionId = sessionCookie?.split(';')[0]?.replace('sessionid=', '') ?? ''
        const body = JSON.stringify({ sessionId })
        proxyRes.resume()  // drain upstream
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode ?? 200, {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body).toString(),
          })
          res.end(body)
        })
        return
      }
      // For non-login: manually pipe with cookie rewriting
      // ... or split into separate proxy entries
    })
  }
}
```

Note: `selfHandleResponse: true` requires that the handler pipes `proxyRes` to `res` for all non-intercepted paths. An alternative is to place `/bggapi/login` and `/bggapi` as two separate proxy entries, with only the login entry using `selfHandleResponse`.

---

## Warnings

### WR-01: `pick` action reads stale `skipQueue` front for `nextPair` but drains a different copy

**File:** `src/store/store.ts:307-319`

**Issue:** The `pick` action computes `nextPair` as:
```typescript
const nextPair =
  skipQueue.length > 0 ? skipQueue[0] : selectRandomPair(newRatings, [])
```
But the new queue is:
```typescript
const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
```
So when `skipQueue` is non-empty, `nextPair = skipQueue[0]` (the front) is consumed, and `newQueue = skipQueue.slice(1)` removes it. This is correct. However, `selectRandomPair` also returns `skipQueue[0]` when `skipQueue` is non-empty (line 114-116 of store.ts). If `skipQueue` is empty, `pick` calls `selectRandomPair(newRatings, [])` with an explicit empty array — bypassing the store's own skip queue. This inconsistency means `pick` and `selectRandomPair` have duplicate queue-drain logic, and a future change to one will silently diverge from the other. This is a latent correctness risk.

**Fix:** Remove the inline queue logic from `pick` and delegate entirely to `selectRandomPair`:
```typescript
pick(winnerId: string, loserId: string): void {
  const { ratings, comparisonsTotal, skipQueue, sessionComparisons } = get()
  const newRatings = applyUpset(winnerId, loserId, ratings)
  const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
  const nextPair = selectRandomPair(newRatings, newQueue)
  set({
    ratings: newRatings,
    comparisonsTotal: comparisonsTotal + 1,
    sessionComparisons: sessionComparisons + 1,
    currentPair: nextPair,
    skipQueue: newQueue,
  })
},
```

---

### WR-02: `login` action silently clears `sessionId` on collection-fetch failure

**File:** `src/store/store.ts:341-355`

**Issue:** `login` stores the `sessionId` from `bggLogin` (line 345), then calls `fetchCollection`. If `fetchCollection` fails, the catch block (line 348-354) sets `view: 'error'` and `errorMessage`, but does NOT clear `sessionId`. The session token now lives in the store indefinitely. If the user subsequently re-enters the entry view and retries (via `resetForNewUser` or navigation), `sessionId` remains set from the previous failed login attempt. This is not a direct security leak (it's not persisted per AUTH-03), but it means the store holds an orphaned credential that could be used by a stale sync action.

**Fix:**
```typescript
} catch {
  set({
    view: 'error',
    errorMessage: 'Could not log in. Check your username and password.',
    loadingMessage: null,
    sessionId: null,   // discard orphaned token on login failure
  })
}
```

---

### WR-03: `completeSyncAll` schedules a `setTimeout` that fires after component unmount

**File:** `src/store/store.ts:413-414`

**Issue:** `completeSyncAll` calls `setTimeout(() => set({ view: 'comparison', syncStatus: 'idle' }), 2000)`. This timer is not tracked or cancelled. If the user navigates away, cancels, or the app unmounts during the 2-second window, the timeout still fires and forcibly sets `view: 'comparison'`, potentially overriding a different view the user has navigated to (e.g., `'entry'` after a `resetForNewUser`). There is no handle returned from this function and no way to cancel it.

**Fix:** Store the timer ID and cancel on the next conflicting state change, or clear it in `cancelSync` and `resetForNewUser`:
```typescript
let completeSyncTimer: ReturnType<typeof setTimeout> | null = null

completeSyncAll(): void {
  if (completeSyncTimer) clearTimeout(completeSyncTimer)
  const total = get().comparisonsTotal
  set({ syncedGameIds: [], comparisonsAtLastSync: total, syncStatus: 'complete' })
  completeSyncTimer = setTimeout(() => {
    completeSyncTimer = null
    set({ view: 'comparison', syncStatus: 'idle' })
  }, 2000)
},

cancelSync(): void {
  if (completeSyncTimer) { clearTimeout(completeSyncTimer); completeSyncTimer = null }
  set({ sessionId: null, view: 'comparison', syncStatus: 'idle' })
},
```

---

### WR-04: `SyncingView` — "Resume Sync" button not disabled while re-auth is in flight

**File:** `src/components/SyncingView.tsx:63`

**Issue:** The "Resume Sync" button calls `reAuthAndResume(reAuthPassword)` with no disabled state. `reAuthAndResume` makes two sequential async calls (`bggLogin` then `startSync`). If the user clicks the button multiple times (double-click or impatience), `reAuthAndResume` will be invoked concurrently: multiple `bggLogin` calls will race, and multiple `startSync` calls will run the sync loop in parallel, writing duplicate ratings to BGG and corrupting `syncedGameIds` and `syncProgress`.

**Fix:** Add a local `isSubmitting` state:
```tsx
const [isSubmitting, setIsSubmitting] = useState(false)

const handleResume = async () => {
  if (!reAuthPassword || isSubmitting) return
  setIsSubmitting(true)
  try {
    await reAuthAndResume(reAuthPassword)
  } finally {
    setIsSubmitting(false)
  }
}
// ...
<button disabled={isSubmitting || !reAuthPassword} onClick={handleResume}>
  {isSubmitting ? 'Resuming…' : 'Resume Sync'}
</button>
```

---

### WR-05: `VITE_BGG_API_BASE` is cast `as string` — silently undefined in production build when env var is unset

**File:** `src/api/bggClient.ts:11`

**Issue:** `export const BGG_API_BASE = import.meta.env.VITE_BGG_API_BASE as string` — when `.env.production` has `VITE_BGG_API_BASE=` (empty string), all fetch URLs become `/login/api/v1`, `/api/geekrating`, etc. — which are relative to the app origin and will 404. This is a known accepted state documented in planning, but the `as string` cast suppresses the TypeScript undefined signal. If someone ships a production build without setting the env var, all network calls silently hit the wrong origin with no warning at build time or runtime.

**Fix:**
```typescript
export const BGG_API_BASE: string = import.meta.env.VITE_BGG_API_BASE ?? ''
if (import.meta.env.DEV && !BGG_API_BASE) {
  console.warn('[bggClient] VITE_BGG_API_BASE is not set — all API calls will fail')
}
```
(This was also flagged in the Phase 2 review as WR-02 and was not resolved.)

---

## Info

### IN-01: `delay` is defined twice — once in `bggClient.ts` and once in `store.ts`

**File:** `src/store/store.ts:136-138` and `src/api/bggClient.ts:35-37`

**Issue:** Both modules contain an identical `delay(ms)` helper. The comment in `store.ts` (line 132) acknowledges this: "Defined here to keep the module boundary clean (not imported from bggClient)." While the intent is defensible, the duplication means any future change to throttle behavior (e.g., changing the delay for tests) must be made in two places.

**Fix:** Extract to a shared `src/utils/delay.ts` utility, or export from `bggClient.ts` and import into `store.ts`.

---

### IN-02: `vitest.config.ts` — no default environment set; `.ts` tests run in Node without jsdom

**File:** `vitest.config.ts:10-12`

**Issue:** `environmentMatchGlobs` only maps `*.test.tsx` to `jsdom`. Plain `.test.ts` files (including `store.test.ts` and `bggClient.test.ts`) run in the default Node environment. This is intentional per the comment in `store.test.ts`, but it means any test that accidentally imports a DOM API (e.g., `window`, `document`) will receive a misleading "not defined" error rather than a clear configuration failure. There is no explicit `environment: 'node'` line to document the intentional choice.

**Fix:** Add `environment: 'node'` explicitly to the config to make the default environment self-documenting.

---

### IN-03: `UsernameEntry` — password trimmed before validation but sent trimmed to `login`

**File:** `src/components/UsernameEntry.tsx:27-47`

**Issue:** `const trimmedPassword = password.trim()` is used for validation (empty check) but also passed to `login(trimmed, trimmedPassword)`. BGG passwords can legitimately contain leading/trailing spaces. Trimming the password before sending it changes the credential and will cause login failures for users with such passwords, with no error message explaining why.

**Fix:** Validate that the raw password field is non-empty (checking the untrimmed value), but send the raw (untrimmed) password to `login`:
```typescript
const rawPassword = password  // do not trim
if (rawPassword === '') {
  setPasswordError('Password is required.')
  hasError = true
}
// ...
login(trimmed, rawPassword)
```

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
