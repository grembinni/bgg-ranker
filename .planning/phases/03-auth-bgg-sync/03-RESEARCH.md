# Phase 3: Auth & BGG Sync — Research

**Researched:** 2026-05-24
**Domain:** BGG authentication (undocumented login endpoint), session management (in-memory, proxy-mediated), batch write sync (throttled, resumable), browser beforeunload guard
**Confidence:** HIGH for all established patterns (codebase is the authoritative source); MEDIUM for BGG endpoint behaviour (undocumented, community-derived)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth UI**
- D-01: Password field appears upfront with username in the existing `UsernameEntry` form. Single form, single submit. No separate auth step or new view.
- D-02: On submit — auth first, then fetch. POST credentials → receive `sessionId` → fetch collection. Sequential. If login fails, user sees an auth error before any collection work starts.
- D-03: Loading screen shows two sequential messages reusing the existing `CollectionLoading` component: first "Logging in to BGG…", then "Fetching your games…" (via the existing `loadingMessage` store field).
- D-04: On return visits — full form required — username + password every time. Upholds AUTH-03 and existing D-08 (no username persistence). The "Found N ranked games" continue-prompt from Phase 2 still appears below the form; continuing a session still requires re-entering credentials before the sync button activates.

**Sync UI & Progress**
- D-05: "Sync to BGG" button lives in the comparison screen header, alongside username and comparison counter.
- D-06: Sync progress uses a dedicated `'syncing'` view state. App.tsx adds a `{view === 'syncing' && <SyncingView />}` branch. Ranking is paused while sync runs.
- D-07: On successful sync completion — auto-return to comparison screen after showing "Sync complete — N games updated" for ~2 seconds. No extra user action needed.
- D-08: Sync button is disabled (grayed out) when 0 unsynced comparisons exist (`comparisonsTotal === comparisonsAtLastSync`). Always visible — user can see the button and understand why it's inactive.

**Mid-Sync 401 Handling**
- D-09: When BGG returns 401 mid-sync, the `SyncingView` shows an inline re-auth form (password field + submit). No view transition. Progress count is visible; sync is paused.
- D-10: After user submits new password — silently re-authenticate (new `sessionId`), then resume sync from last successful write.
- D-11: Sync resume anchor is a persisted `syncedGameIds: string[]` in the store (RankingsStateSlice, included in `partialize`). On sync start, skip any game ID already in this set. Clear `syncedGameIds` and update `comparisonsAtLastSync` after sync fully completes.
- D-12: "Unsaved changes" for `beforeunload` guard — `comparisonsTotal > comparisonsAtLastSync`. Store tracks `comparisonsAtLastSync: number` (persisted). Resets to `comparisonsTotal` after each successful sync.

**Store Shape Changes (Phase 3 additions)**
- D-13: Add to `SessionStateSlice` (ephemeral, excluded from `partialize`): `sessionId: string | null`.
- D-14: Add to `RankingsStateSlice` (persisted): `syncedGameIds: string[]`, `comparisonsAtLastSync: number`.
- D-15: New view state added to the `view` union type: `'syncing'`.
- D-16: New store actions: `login(username, password)`, `startSync()`, `markGameSynced(gameId)`, `completeSyncAll()`, `reAuthAndResume(password)`, `cancelSync()`.

**bggClient Additions**
- D-17: Add `bggLogin(username: string, password: string): Promise<{ sessionId: string }>`. POSTs credentials to BGG login endpoint through proxy. Extracts `sessionId` from response JSON body (per Phase 1 D-07 pattern).
- D-18: Add `bggRateGame(gameId: string, ratingInt: number, sessionId: string): Promise<void>`. Sends `X-BGG-Session` header (per Phase 1 D-08). Throws on non-2xx. Caller interprets 401 as session-expired signal.

### Claude's Discretion
- BGG login endpoint exact URL and POST body format — Claude implements based on PITFALLS.md and smoke-test-dev.sh knowledge
- Throttle implementation between writes — 200–500ms random delay per SYNC-02; Claude picks approach
- Exact success message duration before auto-return (~2 seconds) — Claude decides
- SyncingView cancel behavior — Claude decides whether cancel mid-sync clears `syncedGameIds` or preserves them for resume

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within Phase 3 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can enter BGG username and password to start a session (credentials held in memory only — never written to localStorage or disk) | `sessionId` in `SessionStateSlice` excluded from `partialize`; `bggLogin()` stores result in Zustand only |
| AUTH-02 | App warns the user before tab close if any comparisons have been made since the last BGG sync | `beforeunload` event listener wired to `comparisonsTotal > comparisonsAtLastSync` predicate |
| AUTH-03 | When a BGG write call returns 401 (session expired mid-session), the app prompts the user to re-enter credentials before retrying sync | `SyncingView` inline re-auth form; `reAuthAndResume()` action restores `sessionId` and resumes |
| SYNC-01 | User can manually trigger a batch sync to push all current decimal ratings to BGG as star ratings | `startSync()` action; `bggRateGame()` called per game with `ratingInt / 100`; `SyncingView` component |
| SYNC-02 | App shows progress during sync ("Syncing 47 / 200…") with per-request throttling (200–500ms) | `syncProgress` state counter; `delay(randomMs(200,500))` between `bggRateGame` calls |
| SYNC-03 | If sync is interrupted (page reload, session expiry), the app can resume from where it left off | `syncedGameIds: string[]` persisted in `RankingsStateSlice`; on sync start, skip games already in this set |
</phase_requirements>

---

## Summary

Phase 3 adds the credential layer and the write-back path to the already-complete collection and ranking system. The three concerns — login, sync orchestration, and session resilience — are architecturally independent and can be planned as separate waves.

**Login** is the simplest: add a password field to `UsernameEntry`, introduce `bggLogin()` in `bggClient.ts` (POST to `/login/api/v1` with `{credentials:{username,password}}`), and sequence the existing `fetchCollection` call after a successful login. The proxy infrastructure is already in place; the Vite dev proxy strips `Secure` flags and rewrites the domain so the `Set-Cookie` round-trip works in development. In production the Firebase Function extracts `sessionid` from `Set-Cookie` and returns `{sessionId: "..."}` as JSON — D-07, already live in `proxy/functions/src/index.ts`.

**Sync** is the most complex: `startSync()` iterates all game IDs, calls `bggRateGame()` with `ratingInt / 100` converted to a float, inserts a random 200–500ms delay between calls, and tracks progress. Interruption resilience is handled by persisting `syncedGameIds` — a set that grows as each write succeeds and is cleared only on full completion. The `beforeunload` guard is a single `addEventListener` on the `window`, added/removed based on the `comparisonsTotal > comparisonsAtLastSync` predicate.

**401 mid-sync** is handled inline: the `SyncingView` conditionally renders a password re-entry form when the store's sync state indicates `'session-expired'`, and `reAuthAndResume()` re-acquires a `sessionId` without leaving the syncing view.

**Primary recommendation:** Build in three waves — (1) bggClient additions + store shape + login flow, (2) SyncingView + startSync loop + throttle, (3) 401 re-auth + beforeunload + cleanup. Each wave produces a working, committable state.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| BGG login POST | API Client (`bggClient.ts`) | Store (`store.ts`) | bggClient owns all HTTP; store orchestrates the call and stores result |
| Session token storage | Store / `SessionStateSlice` | — | Token must live in Zustand memory only (AUTH-03); no browser storage |
| sessionId forwarding to BGG | Proxy (Vite dev / Firebase) | API Client | Client sends `X-BGG-Session` header; proxy reattaches as `Cookie: sessionid=...` |
| Sync orchestration loop | Store (`startSync` action) | API Client | Store owns state transitions; bggClient owns the individual HTTP write |
| Sync progress display | `SyncingView` component | Store (`syncProgress`) | Component reads store state; store increments counter per write |
| 401 re-auth | Store (`reAuthAndResume`) + `SyncingView` | API Client | SyncingView renders re-auth form; store calls bggLogin again |
| Resume anchor (syncedGameIds) | Store / `RankingsStateSlice` (persisted) | — | Must survive page reload → needs localStorage via partialize |
| beforeunload guard | `App.tsx` or root hook | Store (read comparisonsTotal/comparisonsAtLastSync) | Browser event; should be in a single top-level effect, not per-component |
| Rating integer → float conversion | Store (`startSync` loop) | — | `ratingInt / 100` at sync time only; never stored as float (D-10) |

---

## Standard Stack

No new packages are needed. All capabilities are achievable with the existing stack.

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand 5 | ^5.0.13 | Store slices, partialize, ephemeral session state | Already in use; `persist` middleware handles new fields automatically |
| React 19 | ^19.0.0 | `SyncingView` component, conditional rendering in `App.tsx` | Already in use |
| TypeScript 5.8 | ~5.8.3 | Type safety for `bggLogin`, `bggRateGame`, store action signatures | Already in use |
| Vitest 4 | ^4.1.7 | Unit tests for `bggLogin`, `bggRateGame`, `startSync` loop | Already in use; `vi.useFakeTimers()` pattern established in bggClient.test.ts |
| Tailwind v4 | ^4.3.0 | `SyncingView` utility classes, inline re-auth form | Already in use; CSS-first, no config file |

### No New Dependencies Required

The throttle delay, `beforeunload` guard, and sync loop are all achievable with `setTimeout`, `window.addEventListener`, and `async/await` — no library additions needed.

**Installation:** No new packages.

---

## Package Legitimacy Audit

No new packages are introduced in Phase 3.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | N/A |

---

## Architecture Patterns

### System Architecture Diagram

```
User enters username + password
           │
           ▼
    UsernameEntry.tsx
    (form submit → login() store action)
           │
           ▼
    store.ts: login(username, password)
    ├── set view='loading', loadingMessage='Logging in to BGG…'
    ├── bggClient.bggLogin(username, password)
    │         │
    │         ▼
    │   POST /bggapi/login/api/v1
    │   {credentials:{username,password}}
    │         │
    │   [dev]  Vite proxy → boardgamegeek.com
    │          Set-Cookie relayed, Secure stripped
    │   [prod] Firebase Function → boardgamegeek.com
    │          Extracts sessionid, returns {sessionId:"..."}
    │         │
    │         ▼
    │   Response: {sessionId: "abc123"}
    │
    ├── set sessionId in SessionStateSlice (ephemeral, never persisted)
    ├── set loadingMessage='Fetching your games…'
    └── bggFetchCollection(username)  [existing Phase 2 logic]
               │
               ▼
        view='comparison'
               │
    ComparisonView.tsx
    header: Sync button (disabled if comparisonsTotal === comparisonsAtLastSync)
               │
    User clicks "Sync to BGG"
               │
               ▼
    store.ts: startSync()
    ├── set view='syncing', syncedGameIds=[]
    └── for each gameId not in syncedGameIds:
        ├── bggClient.bggRateGame(gameId, ratingInt, sessionId)
        │         │
        │   POST /bggapi/api/geekrating
        │   X-BGG-Session: {sessionId}  ← [dev: direct cookie; prod: Firebase reattaches]
        │   objectid=…&objecttype=thing&rating=7.43
        │         │
        │   [200 OK] → markGameSynced(gameId), update progress counter
        │   [401]    → set syncStatus='session-expired', pause loop
        │
        ├── delay(random(200, 500)ms) between writes
        │
        └── [on complete] completeSyncAll()
                  ├── clear syncedGameIds
                  ├── set comparisonsAtLastSync = comparisonsTotal
                  ├── show "Sync complete — N games updated"
                  └── setTimeout 2000ms → set view='comparison'

401 mid-sync path:
    SyncingView.tsx (syncStatus==='session-expired')
    renders inline password field
               │
    User submits new password
               │
               ▼
    store.ts: reAuthAndResume(password)
    ├── bggLogin(username, password) → new sessionId
    ├── set sessionId (replaces expired one)
    └── resume loop from where it stopped (syncedGameIds tracks completed writes)

beforeunload guard (App.tsx effect):
    comparisonsTotal > comparisonsAtLastSync
    → window.addEventListener('beforeunload', handler)
    else → window.removeEventListener('beforeunload', handler)
```

### Recommended Project Structure

No structural changes from Phase 2. New files:

```
src/
├── components/
│   └── SyncingView.tsx          # new — dedicated sync progress view
├── api/
│   └── bggClient.ts             # extend: add bggLogin, bggRateGame
└── store/
    └── store.ts                 # extend: SessionStateSlice, RankingsStateSlice, AppActions
```

### Pattern 1: bggLogin — POST to undocumented login endpoint

**What:** POST JSON credentials to BGG's login API. The proxy (Vite dev or Firebase) handles cookie extraction and returns `{sessionId: "..."}` as JSON body per Phase 1 D-07.

**Evidence:** `scripts/smoke-test-dev.sh` lines 36–56 establish the exact endpoint and body format. `proxy/functions/src/index.ts` lines 27–33 confirm the Firebase extraction and JSON-body response pattern.

```typescript
// Source: scripts/smoke-test-dev.sh + proxy/functions/src/index.ts (verified in codebase)
export async function bggLogin(
  username: string,
  password: string
): Promise<{ sessionId: string }> {
  const res = await fetch(`${BGG_API_BASE}/login/api/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials: { username, password } }),
  })
  if (!res.ok) {
    throw new Error('BGG login failed: HTTP ' + res.status)
  }
  const data = (await res.json()) as { sessionId?: string }
  if (!data.sessionId) {
    throw new Error('BGG login failed: no sessionId in response')
  }
  return { sessionId: data.sessionId }
}
```

**Dev proxy note:** In development, the Vite proxy relays the BGG response including the `Set-Cookie` header (after stripping `Secure` and rewriting the domain to `localhost`). However, because the Firebase Function JSON-body pattern is used for both dev and prod (D-07), the dev path also goes through `bggLogin()` which reads the JSON body. The Vite proxy does NOT do the `sessionid` extraction — that is only the Firebase Function's job. In dev, the login response body comes from BGG directly, which returns the cookie in `Set-Cookie`, not in a JSON body. This is the key discrepancy to resolve. See Open Questions Q1.

### Pattern 2: bggRateGame — POST to undocumented write endpoint

**What:** POST form-encoded data to `/api/geekrating` with the session token as `X-BGG-Session` header. The proxy (Vite dev: relayed as `Cookie`; Firebase: explicitly reattaches as `Cookie: sessionid=...`).

**Evidence:** `scripts/smoke-test-dev.sh` lines 59–71 establish the exact field names. `proxy/functions/src/index.ts` lines 18–21 confirm the `X-BGG-Session` header extraction and `Cookie` reattachment.

```typescript
// Source: scripts/smoke-test-dev.sh + proxy/functions/src/index.ts (verified in codebase)
export async function bggRateGame(
  gameId: string,
  ratingInt: number,
  sessionId: string
): Promise<void> {
  // ratingInt is integer-internal (e.g. 743 = 7.43) — convert to decimal here only (D-10)
  const ratingFloat = (ratingInt / 100).toFixed(2)
  const body = new URLSearchParams({
    objectid: gameId,
    objecttype: 'thing',
    rating: ratingFloat,
  })
  const res = await fetch(`${BGG_API_BASE}/api/geekrating`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-BGG-Session': sessionId,
    },
    body: body.toString(),
  })
  if (!res.ok) {
    // Caller interprets 401 as session-expired — throw with status for caller to check (D-18)
    throw Object.assign(new Error('BGG write failed: HTTP ' + res.status), { status: res.status })
  }
}
```

### Pattern 3: Throttled sync loop in store action

**What:** Sequential async loop with random delay, tracking progress and checking for 401.

```typescript
// Source: pattern derived from existing poll202Loop (bggClient.ts) + SYNC-02 requirement
async startSync(): Promise<void> {
  const { ratings, sessionId, syncedGameIds: alreadySynced } = get()
  if (!sessionId) return

  const allIds = Object.keys(ratings)
  const toSync = allIds.filter(id => !alreadySynced.includes(id))

  set({ view: 'syncing', syncProgress: alreadySynced.length, syncTotal: allIds.length })

  for (const gameId of toSync) {
    const currentSessionId = get().sessionId
    if (!currentSessionId) return  // cancelled or session cleared

    try {
      await bggRateGame(gameId, get().ratings[gameId], currentSessionId)
      get().markGameSynced(gameId)
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401) {
        set({ syncStatus: 'session-expired' })
        return  // loop paused — reAuthAndResume() will restart it
      }
      // Non-401 errors: surface to user, stop sync
      set({ syncStatus: 'error', syncError: String(err) })
      return
    }

    // Throttle: 200–500ms random delay between writes (SYNC-02)
    await delay(200 + Math.floor(Math.random() * 300))
  }

  get().completeSyncAll()
}
```

### Pattern 4: beforeunload guard

**What:** Single `useEffect` in `App.tsx` (or a custom hook) that registers/deregisters the `beforeunload` handler based on whether there are unsynced comparisons.

```typescript
// Source: MDN beforeunload documentation + standard React pattern [ASSUMED: MDN pattern]
useEffect(() => {
  const hasUnsyncedComparisons = comparisonsTotal > comparisonsAtLastSync

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    // Modern browsers ignore the returnValue string and show their own dialog
    e.returnValue = ''
  }

  if (hasUnsyncedComparisons) {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
}, [comparisonsTotal, comparisonsAtLastSync])
```

**Important:** `e.returnValue = ''` is the correct pattern. `return 'message'` from the handler has been deprecated and ignored by all major browsers since ~2015. The browser shows its own generic dialog. [ASSUMED based on training knowledge — MDN docs confirm this behaviour]

### Pattern 5: store.ts partialize extension

**What:** Phase 3 adds two fields to the persisted `RankingsStateSlice` and one ephemeral field to `SessionStateSlice`. The existing `partialize` function must be updated.

```typescript
// Existing partialize in store.ts — extend to include new RankingsStateSlice fields
partialize: (state) => ({
  games: state.games,
  lastFetched: state.lastFetched,
  ratings: state.ratings,
  comparisonsTotal: state.comparisonsTotal,
  rankingsUsername: state.rankingsUsername,
  version: state.version,
  // Phase 3 additions (persisted — SYNC-03 resume anchor)
  syncedGameIds: state.syncedGameIds,
  comparisonsAtLastSync: state.comparisonsAtLastSync,
  // sessionId is NOT listed here — excluded per AUTH-03, D-13
}),
```

### Pattern 6: Dev proxy — session extraction discrepancy

**What:** In dev, the Vite proxy relays the raw BGG login response. BGG returns `Set-Cookie: sessionid=...` in the response headers, not a JSON body. The Vite proxy's `cookieDomainRewrite` makes that cookie available to the browser. However, Phase 1 D-07 and Phase 3 D-17 both specify that `bggLogin()` reads `{sessionId}` from the JSON body — which is what the Firebase Function returns in prod, but NOT what BGG returns directly.

This means `bggLogin()` in dev must handle **both** paths:
1. JSON body with `{sessionId}` (prod / Firebase)
2. The raw BGG response, where `sessionId` is not in the JSON body at all

**Resolution options (see Open Questions Q1):**

Option A: The Vite dev proxy is enhanced to also extract the session cookie and return JSON (mirrors Firebase Function logic in a proxy middleware). Then `bggLogin()` is uniform.

Option B: `bggLogin()` checks for a JSON body first; if absent, falls back to reading the `SessionID` cookie from `document.cookie` (requires the proxy to set the cookie on the browser domain).

The smoke-test-dev.sh confirms option B is what was originally intended: "In dev, extract sessionid from Set-Cookie header" (line 42), with a fallback to JSON body. However, for the SPA, browser JS cannot read an `HttpOnly` cookie. The existing vite.config.ts proxy `proxyRes` handler does NOT strip `HttpOnly` — it only removes `Secure` and rewrites the domain.

**Recommended resolution:** Update the Vite dev proxy's `proxyRes` handler for login responses to strip `HttpOnly` from the Set-Cookie, OR have the dev proxy also extract the sessionid and return a JSON body. The latter approach (mirroring Firebase) keeps `bggLogin()` uniform and is preferable. See Anti-Patterns section.

### Anti-Patterns to Avoid

- **Reading `document.cookie` for sessionId in the SPA:** The BGG `sessionid` cookie is `HttpOnly`. Browser JS cannot read it even if it's set. The Firebase Function pattern (return sessionId as JSON body) is the correct approach for both dev and prod.
- **Persisting `sessionId` to localStorage:** Violates AUTH-03. The `partialize` function must never include `sessionId`.
- **Calling `bggRateGame` directly from `SyncingView`:** Violates the strict "UI components never call bggClient directly" rule (CLAUDE.md). The sync loop belongs in the `startSync()` store action.
- **Storing ratings as floats:** `ratingInt / 100` must only happen inside `bggRateGame()` at the moment of the write. Never store or pass `7.43` — always `743`.
- **Clearing `syncedGameIds` on cancel:** If the user cancels mid-sync, `syncedGameIds` should be preserved (not cleared). This allows resume on the next attempt. Only `completeSyncAll()` clears them. See Open Questions Q6.
- **Using `return 'message'` from beforeunload handler:** Deprecated — ignored by all major browsers. Use `e.preventDefault(); e.returnValue = ''` instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON serialization for persist | Custom serializer | Zustand's built-in `createJSONStorage` | Already in use; handles versioning and hydration |
| Throttle delay utility | A timer library | `delay(ms)` helper already in `bggClient.ts` (line 35) | Already implemented; just use it in the sync loop |
| Sync progress state | A separate React context | Zustand store fields (`syncProgress`, `syncTotal`, `syncStatus`) | Keeps all state in one place; follows existing pattern |
| Cookie manipulation | Manual `Set-Cookie` parsing | Firebase Function's extraction + JSON body return (D-07) | Already implemented in `proxy/functions/src/index.ts` |

**Key insight:** The proxy infrastructure and the `delay()` helper are already built. Phase 3 is primarily wiring new store actions to existing infrastructure, not building new primitives.

---

## Common Pitfalls

### Pitfall 1: `bggLogin()` response format differs between dev and prod

**What goes wrong:** In dev, the Vite proxy relays BGG's raw response (cookie in `Set-Cookie` header, no JSON body). In prod, the Firebase Function transforms the response to `{sessionId: "..."}` JSON. If `bggLogin()` only handles the Firebase format, it will silently fail in dev.

**Why it happens:** Phase 1 designed the Firebase Function path carefully but the Vite dev proxy was not updated to mirror that behaviour. The smoke-test-dev.sh script handles both with a bash fallback (lines 43–47).

**How to avoid:** Extend the Vite dev proxy `configure` callback to add a `proxyRes` listener that specifically intercepts `/login` responses, extracts the `sessionid` from the `Set-Cookie` header, and rewrites the response body to `{sessionId: "..."}`. This makes the dev and prod paths identical from `bggLogin()`'s perspective.

**Warning signs:** `bggLogin()` throws "no sessionId in response" when tested in dev but works in prod smoke test.

---

### Pitfall 2: `syncedGameIds` grows unbounded if sync never completes

**What goes wrong:** Each interrupted sync adds IDs to `syncedGameIds` but never clears them. On the next session, old IDs are skipped even if ratings have changed since they were synced.

**Why it happens:** The "skip already-synced" check uses `syncedGameIds.includes(id)`. If `completeSyncAll()` is never reached, the IDs accumulate.

**How to avoid:** `completeSyncAll()` clears `syncedGameIds` entirely. `startSync()` rebuilds from the current `ratings` object. The IDs in `syncedGameIds` represent "synced in the current interrupted batch" — not "synced ever". This is the correct semantics per D-11.

**Warning signs:** User reports that games are not being re-synced after a comparison session that followed an interrupted sync.

---

### Pitfall 3: Auth-03 partialize regression

**What goes wrong:** A developer adds `sessionId` to the initial state object and forgets to check whether it ends up in `partialize`. The Zustand persist middleware serializes all state unless `partialize` explicitly filters it.

**Why it happens:** The current `partialize` uses an allowlist (explicit field enumeration), which is the correct pattern. A regression would require someone to either add `sessionId` to the allowlist or switch to a denylist approach.

**How to avoid:** The existing partialize is an allowlist. Phase 3 only adds `syncedGameIds` and `comparisonsAtLastSync` — never `sessionId`. The existing UAT smoke test (scripts/uat-smoke.cjs lines 82–91) already checks for unexpected keys in localStorage; extend it to also assert `sessionId` is absent.

**Warning signs:** `localStorage.getItem('bgg-ranker:v1:collection-and-rankings')` JSON contains a `sessionId` key.

---

### Pitfall 4: `startSync()` loop is not cancellable mid-iteration

**What goes wrong:** `startSync()` is an async loop. If `cancelSync()` is called, the loop continues to the next iteration before checking state. One extra write may fire after cancel.

**Why it happens:** The loop reads `get().sessionId` at the top of each iteration. If `cancelSync()` sets `sessionId = null`, the next iteration aborts. But any in-flight `bggRateGame` call will complete.

**How to avoid:** The loop already reads `const currentSessionId = get().sessionId` per iteration. `cancelSync()` clears `sessionId` from the store. The loop check `if (!currentSessionId) return` provides the cancellation signal. At most one in-flight write will complete after cancel — acceptable behaviour.

**Warning signs:** User sees the progress counter increment once after clicking Cancel.

---

### Pitfall 5: `comparisonsAtLastSync` initialization on first sync

**What goes wrong:** On first sync, `comparisonsAtLastSync` is `0`. After sync completes, `completeSyncAll()` sets `comparisonsAtLastSync = comparisonsTotal`. This is correct. But the Sync button disabled check `comparisonsTotal === comparisonsAtLastSync` must use `0 === 0` as the initial disabled state only when zero comparisons have been made — it should not block syncing when comparisons exist.

**Why it happens:** The default initial value of `comparisonsAtLastSync` is `0`. `comparisonsTotal` is also `0` on first load. They are equal → button is disabled. After first comparison: `comparisonsTotal = 1`, `comparisonsAtLastSync = 0` → button enables. This is correct behaviour per D-08.

**How to avoid:** No code change needed — the initial state is correct. Document this in the store initializer as a comment: "Both start at 0 → button disabled until first comparison."

**Warning signs:** Sync button is unexpectedly enabled on a fresh session before any comparisons.

---

### Pitfall 6: `beforeunload` fires during sync itself

**What goes wrong:** While sync is running (view = 'syncing'), if the user closes the tab, `beforeunload` fires. But the sync is actively running — `syncedGameIds` will not be fully populated yet. This is correct behaviour — the guard should fire. But the user may be confused: "I clicked Sync but it's warning me?"

**How to avoid:** The guard is based on `comparisonsTotal > comparisonsAtLastSync`, which remains true until `completeSyncAll()` is called. This means the guard fires during an in-progress sync if the tab is closed. This is intentional — data loss (partial sync) is the exact condition the guard protects against. No code change needed; document this in the `beforeunload` effect comment.

---

## Code Examples

### Verified Patterns from Existing Code

#### delay() helper — already in bggClient.ts (line 35)
```typescript
// Source: src/api/bggClient.ts (verified in codebase)
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```
Reuse in the sync loop: `await delay(200 + Math.floor(Math.random() * 300))`

#### pick() action pattern — template for markGameSynced()
```typescript
// Source: src/store/store.ts lines 271–283 (verified in codebase)
// pick() uses set() to update a single field atomically — same pattern for markGameSynced
markGameSynced(gameId: string): void {
  const { syncedGameIds, syncProgress } = get()
  set({
    syncedGameIds: [...syncedGameIds, gameId],
    syncProgress: syncProgress + 1,
  })
}
```

#### Zustand partialize pattern — established in Phase 2
```typescript
// Source: src/store/store.ts lines 304–313 (verified in codebase)
partialize: (state) => ({
  games: state.games,
  lastFetched: state.lastFetched,
  ratings: state.ratings,
  comparisonsTotal: state.comparisonsTotal,
  rankingsUsername: state.rankingsUsername,
  version: state.version,
  // Phase 3: add syncedGameIds + comparisonsAtLastSync; do NOT add sessionId
}),
```

#### Firebase Function login extraction — prod path already live
```typescript
// Source: proxy/functions/src/index.ts lines 27–33 (verified in codebase)
if (isLogin) {
  const cookies = upstreamRes.headers['set-cookie'] || []
  const sessionCookie = cookies.find((c) => c.startsWith('sessionid='))
  const sessionId = sessionCookie?.split(';')[0]?.replace('sessionid=', '') || ''
  res.status(upstreamRes.statusCode || 200).json({ sessionId })
}
```

#### BGG geekrating request format — confirmed by smoke-test-dev.sh
```bash
# Source: scripts/smoke-test-dev.sh lines 60–63 (verified in codebase)
# objectid=<gameId>&objecttype=thing&rating=<decimal>
# Method: POST
# Endpoint: /api/geekrating
# Auth: Cookie: sessionid=... (dev) / X-BGG-Session header (prod → Firebase reattaches)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `beforeunload` returning a string | `e.preventDefault(); e.returnValue = ''` | ~2015 (all browsers) | Must use the new pattern — string return is ignored |
| Cookie-based SPA auth (HttpOnly, browser stores) | Token extracted server-side, returned as JSON body | Phase 1 D-07 | `bggLogin()` reads JSON, never `document.cookie` |

---

## Open Questions

### Q1: Dev proxy login response — JSON body or Set-Cookie relay?

**What we know:** Firebase Function returns `{sessionId: "..."}` JSON (prod). Vite dev proxy relays raw BGG response — cookie in `Set-Cookie`, no JSON body (dev). `bggLogin()` per D-17 reads JSON body. BGG's `sessionid` cookie is `HttpOnly` so browser JS cannot read `document.cookie`.

**What's unclear:** How does `bggLogin()` get `sessionId` in dev? There is currently a gap between the D-07 contract and the Vite dev proxy behaviour.

**Recommendation:** Extend the Vite dev proxy `configure` `proxyRes` handler to intercept `/login/api/v1` responses, extract the `sessionid` from `Set-Cookie`, and rewrite the response body to `{sessionId: "..."}` JSON — identical to what Firebase does. This makes `bggLogin()` uniform across environments and requires no fallback code in the client. The existing `configure` callback in vite.config.ts already has a `proxyRes` handler skeleton (lines 22–28) — extend it to intercept login paths. Implementation adds ~15 lines to vite.config.ts.

---

### Q2: SyncingView cancel — preserve or clear `syncedGameIds`?

**What we know:** D-11 says `syncedGameIds` is cleared only when `completeSyncAll()` succeeds. D-16 defines `cancelSync()` as a separate action.

**What's unclear:** If the user cancels mid-sync (not because of a 401, but deliberately), should `syncedGameIds` be preserved (allowing partial resume on next sync attempt) or cleared (forcing a full re-sync)?

**Recommendation:** Preserve `syncedGameIds` on cancel. The user may cancel because the sync is taking too long — not because they want to restart. On the next "Sync to BGG" click, the resumed sync skips games already sent. This is the same behaviour as a page-reload interruption (SYNC-03). If the user wants a full re-sync, they can wait until sync completes and then do another sync after new comparisons.

---

### Q3: `syncStatus` field shape in store

**What we know:** The sync loop needs to communicate state to `SyncingView`: idle, syncing, session-expired, error, complete. D-16 defines actions but not a `syncStatus` field.

**What's unclear:** Should `syncStatus` be a string union in `SessionStateSlice` (ephemeral) or derived from `view`?

**Recommendation:** Add `syncStatus: 'idle' | 'syncing' | 'session-expired' | 'error' | 'complete'` to `ComparisonStateSlice` (not persisted — session-only). `SyncingView` reads `syncStatus` to decide whether to show the progress bar, inline re-auth form, or success message. Keep `syncProgress: number` and `syncTotal: number` alongside it. The `view` field indicates which component to render; `syncStatus` is the sub-state within the syncing view.

---

### Q4: BGG accepted rating precision

**What we know:** `ratingInt / 100` produces values like `7.43`. BGG accepts decimal ratings. RANK-08 specifies values like `8.01` through `9.00`.

**What's unclear:** Does BGG accept 2-decimal precision (e.g., `7.43`) or only 1-decimal (e.g., `7.4`)? The smoke-test uses integer `7` for testing.

**Recommendation (ASSUMED):** Use `(ratingInt / 100).toFixed(2)` which produces e.g. `"7.43"`. BGG's rating UI accepts 0.1 increments but the API likely accepts arbitrary decimals (it's a database `FLOAT` field). If BGG silently rounds, the user will see slightly different values on BGG than in the app — acceptable. Verify with a single live test during wave 2. [ASSUMED]

---

### Q5: `completeSyncAll()` action — `comparisonsAtLastSync` initialization

**Context note:** Per D-12 and the CONTEXT.md specifics section: "`comparisonsAtLastSync` initialized to `comparisonsTotal` on first sync start". This means `startSync()` should capture `comparisonsTotal` at the moment sync begins, not at `completeSyncAll()` time. Ratings may change between sync-start and sync-complete if... actually no — the view is `'syncing'` while sync runs, which pauses ranking (D-06). So `comparisonsTotal` cannot change during sync. Either location (startSync or completeSyncAll) is equivalent.

**Recommendation:** Set `comparisonsAtLastSync = comparisonsTotal` in `completeSyncAll()`. Simpler, and safe because ranking is paused.

---

### Q6: `UsernameEntry` form after Phase 3 — label and description copy update

**What we know:** The existing form says "Enter your BGG username to load your collection." and has a single username field. Phase 3 adds a password field per D-01.

**What's unclear:** What copy to use for the form description.

**Recommendation:** Change description to "Enter your BGG username and password to load your collection and enable sync." Update `<label>` for the new field to "BGG Password" with `type="password"` and `autocomplete="current-password"`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vite dev server | All dev work | ✓ | 6.x | — |
| Firebase CLI | Proxy deploy (Phase 5) | Not checked (not needed until Phase 5) | — | Dev proxy covers Phase 3 |
| BGG API (live) | bggLogin, bggRateGame smoke test | ✓ (external service) | — | Scripts/smoke-test-dev.sh |
| Node.js | Vitest test runner | ✓ (part of dev setup) | — | — |

**Missing dependencies with no fallback:** None for Phase 3 development (Firebase deploy is Phase 5).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 |
| Config file | `vite.config.ts` (vitest configured inline) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `bggLogin()` returns sessionId from JSON body | unit | `npm test -- --reporter=verbose` (src/api/bggClient.test.ts) | ❌ Wave 0 |
| AUTH-01 | `bggLogin()` throws on non-2xx response | unit | same | ❌ Wave 0 |
| AUTH-01 | `sessionId` absent from localStorage after login | unit | `src/store/store.test.ts` | ❌ Wave 0 |
| AUTH-02 | `beforeunload` listener added when comparisonsTotal > comparisonsAtLastSync | unit | React Testing Library in `src/components/App.test.tsx` | ❌ Wave 0 |
| AUTH-03 | `reAuthAndResume()` replaces sessionId and resumes sync | unit | `src/store/store.test.ts` | ❌ Wave 0 |
| SYNC-01 | `startSync()` calls `bggRateGame` for each game | unit | `src/store/store.test.ts` | ❌ Wave 0 |
| SYNC-01 | `bggRateGame()` sends ratingInt/100 (float conversion) | unit | `src/api/bggClient.test.ts` | ❌ Wave 0 |
| SYNC-01 | `bggRateGame()` throws on non-2xx with `.status` property | unit | `src/api/bggClient.test.ts` | ❌ Wave 0 |
| SYNC-02 | Progress counter increments after each write | unit | `src/store/store.test.ts` | ❌ Wave 0 |
| SYNC-02 | Delay called between writes (200–500ms range) | unit (fake timers) | `src/store/store.test.ts` | ❌ Wave 0 |
| SYNC-03 | Already-synced gameIds are skipped on resume | unit | `src/store/store.test.ts` | ❌ Wave 0 |
| SYNC-03 | `syncedGameIds` cleared only by `completeSyncAll()` | unit | `src/store/store.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/api/bggClient.test.ts` — extend with `bggLogin` and `bggRateGame` test cases (file exists; append new describe blocks)
- [ ] `src/store/store.test.ts` — new file; covers login action, sync loop, partialize exclusion of sessionId, syncedGameIds persistence, beforeunload predicate

*(Existing test infrastructure covers all other Phase 2 requirements — no framework changes needed)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Credentials in Zustand SessionStateSlice only; never persisted (AUTH-03) |
| V3 Session Management | yes | sessionId in memory only; `partialize` excludes it; cleared on page reload |
| V4 Access Control | no | Single-user app; no role separation |
| V5 Input Validation | yes | Username and password trimmed before submission; no XSS vector in stored data |
| V6 Cryptography | no | No client-side crypto; proxy handles HTTPS |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential exfiltration via localStorage | Information Disclosure | `partialize` allowlist never includes `sessionId` or password; verified by UAT test |
| Session fixation via `Set-Cookie` relay | Elevation of Privilege | Firebase Function extracts `sessionid` and returns as JSON body — never relays `Set-Cookie` to browser |
| XSS reads in-memory sessionId | Information Disclosure | sessionId is in Zustand closure, not in DOM or `window`; no user-controlled HTML rendered in SyncingView |
| BGG session cookie `HttpOnly` bypass | Tampering | Irrelevant — the app never reads `document.cookie`; sessionId comes from JSON body |
| Throttle bypass (rapid writes) | Denial of Service | `delay(200 + random*300)` between every write; enforced in sync loop, not skippable |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BGG `/api/geekrating` accepts `objecttype=thing` and `rating=<decimal>` form fields with session cookie | Standard Stack / bggRateGame pattern | Write calls will fail; would need to reverse-engineer correct field names |
| A2 | BGG accepts 2-decimal-precision ratings (e.g., `7.43`) via the geekrating endpoint | Open Questions Q4 | BGG may silently round to 1 decimal; minor data fidelity issue, not a hard failure |
| A3 | `beforeunload` `e.returnValue = ''` shows browser-native dialog on all major browsers (Chrome, Firefox, Safari, Edge) | beforeunload pattern | If a browser ignores it, the guard silently fails; user loses work without warning |
| A4 | BGG login endpoint `/login/api/v1` accepts `{credentials:{username,password}}` JSON body | bggLogin pattern | Login will fail with 400/401; would need to find correct body format |

Note: A1 and A4 have HIGH confidence from codebase evidence (smoke-test-dev.sh and proxy/functions/src/index.ts establish the exact formats). Tagged ASSUMED only because BGG's endpoint is undocumented and could change.

---

## Sources

### Primary (HIGH confidence — verified in codebase)
- `scripts/smoke-test-dev.sh` — BGG login URL, POST body format, geekrating field names, session extraction
- `scripts/smoke-test-prod.sh` — Firebase Function URL convention, D-07 JSON-body pattern for prod
- `proxy/functions/src/index.ts` — `isLogin` detection, sessionid extraction, `X-BGG-Session` → `Cookie` reattachment, JSON response
- `vite.config.ts` — Vite proxy config, `cookieDomainRewrite`, `proxyRes` handler for Secure stripping
- `src/api/bggClient.ts` — `delay()` helper, `poll202Loop` pattern, `BGG_API_BASE` wiring, error throwing conventions
- `src/store/store.ts` — `partialize` allowlist, slice interfaces, action patterns (`pick`, `skip`), `selectRandomPair`
- `src/components/ComparisonView.tsx` — Header layout, existing button patterns
- `src/components/UsernameEntry.tsx` — Form structure, validation pattern, continue-prompt layout
- `src/App.tsx` — View switch pattern for adding `'syncing'` branch

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` — C2 (cookie/session), M3 (throttling), M4 (undocumented write endpoint), M6 (partial sync), M7 (re-auth)
- `.planning/research/ARCHITECTURE.md` — BGG auth flow diagram, Zustand slice interfaces, partialize rules
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-07, D-08, D-10 (carry-forward decisions)

### Tertiary (LOW confidence — training knowledge, not verified against live BGG API)
- BGG `/api/geekrating` accepting 2-decimal precision ratings
- `beforeunload` `e.returnValue = ''` browser support across all current browsers

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing dependencies verified in package.json
- Architecture: HIGH — codebase is the authoritative source; proxy pattern is live code
- BGG endpoint behaviour: MEDIUM — confirmed in smoke-test scripts, not verified against live API
- beforeunload pattern: HIGH — well-established browser API; MDN-confirmed

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (BGG undocumented endpoints could change; browser APIs are stable)
