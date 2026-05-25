# Phase 4: Display Polish - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 4 modified files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/GameCard.tsx` | component | request-response | `src/components/GameCard.tsx` (self, in-place upgrade) | exact |
| `src/components/ComparisonView.tsx` | component | event-driven | `src/components/ComparisonView.tsx` (self, in-place upgrade) | exact |
| `src/store/store.ts` | store | event-driven | `src/store/store.ts` (self, in-place extension) | exact |
| `src/components/UsernameEntry.tsx` | component | request-response | `src/components/UsernameEntry.tsx` (self, simplification) | exact |

All files are in-place edits — no new files are created. The codebase is its own best analog.

---

## Pattern Assignments

### `src/components/GameCard.tsx` (component, request-response)

**Analog:** `src/components/GameCard.tsx` — upgrade in-place

**Imports pattern** (lines 1):
```typescript
import { useStore } from '../store/store'
```
No new imports needed. Game interface already has `id`, `name`, `thumbnail`, `yearPublished`.

**Current thumbnail pattern to replace** (lines 33-39):
```tsx
{game.thumbnail && (
  <img
    src={game.thumbnail.startsWith('//') ? `https:${game.thumbnail}` : game.thumbnail}
    alt={game.name}
    className="w-full h-32 object-contain"
  />
)}
```

**New thumbnail pattern (D-06) — replace the block above with:**
```tsx
{game.thumbnail ? (
  <a href={`https://boardgamegeek.com/boardgame/${game.id}`} target="_blank" rel="noopener noreferrer">
    <img
      src={game.thumbnail.startsWith('//') ? `https:${game.thumbnail}` : game.thumbnail}
      alt={game.name}
      className="w-full h-48 object-contain aspect-square"
    />
  </a>
) : (
  <div className="h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm aspect-square">
    No image
  </div>
)}
```
Key changes: `h-32` → `h-48`, conditional → ternary, add `aspect-square`, wrap `<img>` in `<a>` with BGG link, add placeholder `<div>`.

**Rank display pattern to replace** (line 42):
```tsx
<div className="text-sm text-gray-500">#{rank} of {totalGames}</div>
```

**New rank display (D-06) — drop the `totalGames` variable and `"of N total"` text:**
```tsx
<div className="text-sm text-gray-500">#{rank}</div>
```
Also remove `const totalGames = Object.keys(ratings).length` (line 20) since it is no longer used.

**Button pattern** (lines 43-49) — unchanged:
```tsx
<button
  type="button"
  onClick={onPick}
  className="mt-auto w-full min-h-[44px] bg-blue-600 text-white text-base font-semibold rounded px-4 py-2 hover:bg-blue-700 active:bg-blue-800 outline-2 outline-offset-2 outline-blue-600"
>
  Pick this game
</button>
```

---

### `src/components/ComparisonView.tsx` (component, event-driven)

**Analog:** `src/components/ComparisonView.tsx` — upgrade in-place

**Imports pattern** (lines 1-3) — add `useState`:
```tsx
import { useState } from 'react'
import { useStore } from '../store/store'
import GameCard from './GameCard'
```

**Store selectors to add** (after existing selectors, around line 18):
```tsx
const lastUpset = useStore(s => s.lastUpset)
const logout = useStore(s => s.logout)
```

**Local state for hamburger** (D-08 — no store involvement):
```tsx
const [menuOpen, setMenuOpen] = useState(false)
```

**Hamburger handler pattern** (D-08 — dismiss on action click):
```tsx
const handleSync = () => { setMenuOpen(false); startSync() }
const handleRefresh = () => { setMenuOpen(false); refresh() }
const handleLogout = () => { setMenuOpen(false); logout() }
```

**Current header pattern to replace** (lines 34-45):
```tsx
<header className="flex justify-between items-center mb-8 text-base text-gray-700">
  <span>{sessionUsername}</span>
  <span>{sessionComparisons} this session · {comparisonsTotal} total</span>
  <button
    type="button"
    onClick={startSync}
    disabled={syncDisabled}
    className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Sync to BGG
  </button>
</header>
```

**New header pattern (D-08, D-09) — hamburger left, counter center, username right:**
```tsx
<header className="flex justify-between items-center mb-8 text-base text-gray-700">
  <div className="relative">
    <button
      type="button"
      onClick={() => setMenuOpen(o => !o)}
      className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
      aria-label="Menu"
    >
      ☰
    </button>
    {menuOpen && (
      <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded shadow-sm z-10 flex flex-col">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncDisabled}
          className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sync to BGG
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
        >
          Refresh rankings
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
        >
          Logout
        </button>
      </div>
    )}
  </div>
  <span>{sessionComparisons} this session · {comparisonsTotal} total</span>
  <span>{sessionUsername}</span>
</header>
```
`syncDisabled` computation is unchanged: `const syncDisabled = !sessionId || dirtyGameIds.length === 0` (line 20).

**Upset callout row (D-04, D-05) — insert between the grid and action buttons:**

Current structure (lines 46-57, 58-87):
```tsx
<div className="grid grid-cols-2 gap-6">
  {/* ... GameCard × 2 */}
</div>
<div className="flex gap-4 justify-center mt-8">
  {/* ... action buttons */}
</div>
```

New structure — add callout row between them:
```tsx
<div className="grid grid-cols-2 gap-6">
  {/* ... GameCard × 2 — unchanged */}
</div>
{lastUpset !== null && (
  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-2 text-center text-sm mt-4">
    {lastUpset.winnerName} moved up {lastUpset.spotsGained} {lastUpset.spotsGained === 1 ? 'spot' : 'spots'}
  </div>
)}
<div className="flex gap-4 justify-center mt-8">
  {/* ... Skip, Ranked list, Unplayed — Refresh and Sync to BGG removed */}
</div>
```

**Buttons to remove from action bar (D-08):** Remove the standalone Refresh and (already absent from action bar) Sync buttons. Remaining action buttons: Skip, Ranked list, Unplayed — using existing button className:
```tsx
className="px-6 py-2 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
```

---

### `src/store/store.ts` (store, event-driven)

**Analog:** `src/store/store.ts` — extend in-place

**Module-level timer pattern to mirror** (line 152):
```typescript
let completeSyncTimer: ReturnType<typeof setTimeout> | null = null
```
Add directly below this line:
```typescript
let upsetTimer: ReturnType<typeof setTimeout> | null = null
```

**ComparisonStateSlice extension (D-03) — add `lastUpset` field:**

Current slice interface (lines 63-73):
```typescript
interface ComparisonStateSlice {
  view: 'entry' | 'loading' | 'comparison' | 'error' | 'syncing' | 'ranked-list' | 'unplayed-list'
  currentPair: [string, string] | null
  sessionComparisons: number
  skipQueue: Array<[string, string]>
  loadingMessage: string | null
  errorMessage: string | null
  syncStatus: 'idle' | 'syncing' | 'session-expired' | 'error' | 'complete'
  syncProgress: number
  syncTotal: number
}
```
Add `lastUpset` to this interface:
```typescript
lastUpset: { winnerName: string; spotsGained: number } | null
```

**AppActions extension — add `logout` action:**

After the existing `cancelSync(): void` entry (line 95) in `AppActions`:
```typescript
logout(): void
```

**Initial state extension (after `syncTotal: 0`, around line 193):**
```typescript
lastUpset: null,
```

**`pick()` action extension (D-01, D-02, D-03) — extend the existing action at lines 335-353:**

Current `pick()` (lines 335-353):
```typescript
pick(winnerId: string, loserId: string): void {
  const { ratings, comparisonsTotal, skipQueue, sessionComparisons, dirtyGameIds } = get()
  const newRatings = applyUpset(winnerId, loserId, ratings)
  const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
  const nextPair = selectRandomPair(newRatings, skipQueue)
  const changed = Object.keys(newRatings).filter(id => newRatings[id] !== ratings[id])
  const newDirty = [...new Set([...dirtyGameIds, ...changed])]
  set({
    ratings: newRatings,
    comparisonsTotal: comparisonsTotal + 1,
    sessionComparisons: sessionComparisons + 1,
    currentPair: nextPair,
    skipQueue: newQueue,
    dirtyGameIds: newDirty,
  })
},
```

Extended `pick()` with upset detection before `applyUpset` call (Pitfall 2 — pre-upset positions):
```typescript
pick(winnerId: string, loserId: string): void {
  const { ratings, comparisonsTotal, skipQueue, sessionComparisons, dirtyGameIds, games } = get()

  // Compute pre-upset positions (Pitfall 2: must be BEFORE applyUpset)
  const ranked = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  const winnerPos = ranked.findIndex(([id]) => id === winnerId)
  const loserPos = ranked.findIndex(([id]) => id === loserId)

  const newRatings = applyUpset(winnerId, loserId, ratings)
  const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
  const nextPair = selectRandomPair(newRatings, skipQueue)
  const changed = Object.keys(newRatings).filter(id => newRatings[id] !== ratings[id])
  const newDirty = [...new Set([...dirtyGameIds, ...changed])]

  // Upset detection (D-01): winner was ranked lower than loser
  let newLastUpset: { winnerName: string; spotsGained: number } | null = null
  if (winnerPos > loserPos && winnerPos !== -1 && loserPos !== -1) {
    const spotsGained = winnerPos - loserPos
    const winnerName = games[winnerId]?.name ?? winnerId
    newLastUpset = { winnerName, spotsGained }
    // Cancel previous timer before scheduling new one (Pitfall 1)
    if (upsetTimer) { clearTimeout(upsetTimer); upsetTimer = null }
    upsetTimer = setTimeout(() => {
      upsetTimer = null
      set({ lastUpset: null })
    }, 5000)
  }

  set({
    ratings: newRatings,
    comparisonsTotal: comparisonsTotal + 1,
    sessionComparisons: sessionComparisons + 1,
    currentPair: nextPair,
    skipQueue: newQueue,
    dirtyGameIds: newDirty,
    lastUpset: newLastUpset,
  })
},
```

**`login()` action extension (D-07) — auto-resume for returning user:**

Current `login()` at lines 423-438:
```typescript
async login(username: string, password: string): Promise<void> {
  set({ view: 'loading', loadingMessage: 'Logging in to BGG…', errorMessage: null })
  try {
    const result = await bggLogin(username, password)
    set({ sessionId: result.sessionId, loadingMessage: 'Fetching your games…' })
    // Delegate collection fetch to existing action
    await get().fetchCollection(username)
  } catch {
    set({
      view: 'error',
      errorMessage: 'Could not log in. Check your username and password.',
      loadingMessage: null,
      sessionId: null,
    })
  }
},
```

Extended `login()` with PERSIST-02 auto-resume check (Pitfall 3 — check BEFORE calling fetchCollection):
```typescript
async login(username: string, password: string): Promise<void> {
  set({ view: 'loading', loadingMessage: 'Logging in to BGG…', errorMessage: null })
  try {
    const result = await bggLogin(username, password)
    set({ sessionId: result.sessionId, sessionUsername: username })

    // D-07: auto-resume if stored rankings belong to this user (PERSIST-02 guard)
    const state = get()
    if (
      state.rankingsUsername === username &&
      Object.keys(state.ratings).length > 0 &&
      Object.keys(state.games).length > 0
    ) {
      get().continueSession()
    } else {
      set({ loadingMessage: 'Fetching your games…' })
      await get().fetchCollection(username)
    }
  } catch {
    set({
      view: 'error',
      errorMessage: 'Could not log in. Check your username and password.',
      loadingMessage: null,
      sessionId: null,
    })
  }
},
```

**New `logout()` action (D-08) — clears session, preserves rankings:**

Add after `cancelSync()` at line 537:
```typescript
logout(): void {
  // Cancel any in-flight sync (idempotent — sets sessionId=null which aborts startSync loop)
  get().cancelSync()
  // Clear session fields; do NOT clear ratings/games/rankingsUsername (D-08)
  set({ sessionId: null, sessionUsername: null, view: 'entry' })
},
```

**`partialize` — `lastUpset` must NOT appear (Pitfall 5):**

Current `partialize` at lines 542-554:
```typescript
partialize: (state) => ({
  games: state.games,
  lastFetched: state.lastFetched,
  ratings: state.ratings,
  comparisonsTotal: state.comparisonsTotal,
  rankingsUsername: state.rankingsUsername,
  version: state.version,
  dirtyGameIds: state.dirtyGameIds,
  comparisonsAtLastSync: state.comparisonsAtLastSync,
  unplayedIds: state.unplayedIds,
}),
```
No changes to `partialize`. `lastUpset` is session-only and must not be added here.

**`resetForNewUser()` — cancel `upsetTimer` alongside `completeSyncTimer` (lines 317-333):**

Add `upsetTimer` cancellation to the existing pattern:
```typescript
resetForNewUser(): void {
  if (completeSyncTimer) { clearTimeout(completeSyncTimer); completeSyncTimer = null }
  if (upsetTimer) { clearTimeout(upsetTimer); upsetTimer = null }   // add this line
  set({ ... })  // existing set call unchanged
},
```

---

### `src/components/UsernameEntry.tsx` (component, request-response)

**Analog:** `src/components/UsernameEntry.tsx` — simplify in-place (remove continue-prompt branch)

**Current store selectors** (lines 10-16):
```typescript
const login = useStore((s) => s.login)
const continueSession = useStore((s) => s.continueSession)
const resetForNewUser = useStore((s) => s.resetForNewUser)
const sessionUsername = useStore((s) => s.sessionUsername)
const rankingsUsername = useStore((s) => s.rankingsUsername)
const ratings = useStore((s) => s.ratings)
```

**Selectors to remove (D-07 — auto-resume is now in store.login(), not component):**
```typescript
// REMOVE: continueSession, resetForNewUser, sessionUsername, rankingsUsername, ratings
// KEEP: login only
const login = useStore((s) => s.login)
```

**State variables to remove:**
```typescript
// REMOVE: showContinuePrompt (lines 17-21) and ratingsCount (line 22)
```

**Continue prompt JSX to remove** (lines 101-123):
```tsx
{showContinuePrompt && (
  <div className="mt-6 pt-6 border-t border-gray-200">
    <p className="text-base text-gray-700">
      Found {ratingsCount} ranked games from your last session.
    </p>
    <div className="flex gap-4 mt-4">
      <button type="button" onClick={continueSession} ...>Continue ranking</button>
      <button type="button" onClick={resetForNewUser} ...>Re-fetch collection</button>
    </div>
  </div>
)}
```
Delete this entire block. The form and validation logic (lines 24-97) remain unchanged.

**Form submit pattern** (lines 24-48) — unchanged, already calls `login(trimmed, trimmedPassword)`:
```typescript
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  const trimmed = input.trim()
  const trimmedPassword = password.trim()

  let hasError = false
  if (trimmed === '') { setValidationError('Username is required.'); hasError = true }
  else { setValidationError(null) }
  if (trimmedPassword === '') { setPasswordError('Password is required.'); hasError = true }
  else { setPasswordError(null) }
  if (hasError) return

  login(trimmed, trimmedPassword)
}
```

**`fetchCollection()` PERSIST-02 guard cleanup — remove the "Continue?" redirect:**

After the `login()` auto-resume check is added to `login()`, the PERSIST-02 guard in `fetchCollection()` at lines 204-212 becomes dead code for the login path. It should be removed so `fetchCollection()` always proceeds to fetch:
```typescript
// REMOVE from fetchCollection():
if (
  state.rankingsUsername === username &&
  Object.keys(state.ratings).length > 0 &&
  Object.keys(state.games).length > 0
) {
  set({ sessionUsername: username, view: 'entry' })
  return
}
```
This guard's purpose (detect returning user) now lives exclusively in `login()`.

---

## Shared Patterns

### Tailwind button class (all buttons in this app)
**Source:** `src/components/ComparisonView.tsx` lines 59-63 and `src/components/GameCard.tsx` lines 43-49
**Apply to:** All new interactive elements in Phase 4 (hamburger button, dropdown menu items)
```tsx
// Standard action button (opaque background):
className="px-6 py-2 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"

// With disabled state:
className="... disabled:opacity-50 disabled:cursor-not-allowed"
```

### Module-level timer pattern
**Source:** `src/store/store.ts` line 152 (`completeSyncTimer`) and lines 496-507 (`completeSyncAll`)
**Apply to:** `upsetTimer` in `store.ts` (D-03)
```typescript
// Declaration — module-level, never in Zustand state or React state:
let upsetTimer: ReturnType<typeof setTimeout> | null = null

// Usage — cancel before setting new timer:
if (upsetTimer) { clearTimeout(upsetTimer); upsetTimer = null }
upsetTimer = setTimeout(() => {
  upsetTimer = null
  set({ lastUpset: null })
}, 5000)
```

### Conditional render (no reserved slot)
**Source:** `src/components/UsernameEntry.tsx` lines 101-123 (showContinuePrompt pattern)
**Apply to:** Upset callout in `ComparisonView.tsx` (D-04)
```tsx
// Pattern: render nothing when null — avoid visibility:hidden or height placeholder
{lastUpset !== null && (
  <div ...>...</div>
)}
```

### Store selector pattern
**Source:** `src/components/ComparisonView.tsx` lines 5-18
**Apply to:** New `lastUpset` and `logout` selectors in `ComparisonView.tsx`
```tsx
// One selector per field — allows React to skip renders when unrelated fields change:
const lastUpset = useStore(s => s.lastUpset)
const logout = useStore(s => s.logout)
```

### Test mock extension pattern
**Source:** `src/components/ComparisonView.test.tsx` lines 33-55
**Apply to:** Extending the mock for Phase 4 assertions
```typescript
vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      // ... existing fields (keep all) ...
      lastUpset: null,          // add — D-03 default
      logout: vi.fn(),          // add — D-08
      // Note: remove startSync from top-level action bar if button is moved to hamburger
    }),
}))
```

---

## No Analog Found

All Phase 4 files have exact analogs (themselves). No new patterns from outside the existing codebase are required.

| File | Role | Data Flow | Reason |
|---|---|---|---|
| *(none)* | — | — | All changes are in-place edits to files already fully read in this session |

---

## Metadata

**Analog search scope:** `src/components/`, `src/store/`
**Files scanned:** 4 source files + 2 test files
**Pattern extraction date:** 2026-05-25