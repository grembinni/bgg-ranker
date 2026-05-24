---
phase: 02-collection-ranking
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/api/bggClient.ts
  - src/api/bggClient.test.ts
  - src/store/store.ts
  - src/store/store.test.ts
  - src/components/UsernameEntry.tsx
  - src/components/CollectionLoading.tsx
  - src/components/ErrorDisplay.tsx
  - src/components/GameCard.tsx
  - src/components/ComparisonView.tsx
  - src/App.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the BGG client layer, Zustand store, and all five UI components. The architecture is sound and the separation of concerns (bggClient isolated from UI, integer-internal ratings, partialize excluding session fields) is correctly implemented.

Two blockers were found: one crashes the fetch for any user with no rated-but-unowned games (very common), and one causes the same pair to be re-presented immediately after a pick when the skip queue is draining. Four warnings cover less-frequent but plausible breakage paths.

---

## Critical Issues

### CR-01: `fetchCollection` crashes for users with no rated-but-unowned games

**File:** `src/api/bggClient.ts:159-167`

**Issue:** `fetchCollection` fires two requests in parallel and passes both XML responses to `parseCollectionXml`. `parseCollectionXml` unconditionally throws `'BGG returned 0 games — not writing to localStorage'` when it parses an empty collection. The rated-but-unowned query (`rated=1&own=0`) will return 0 items for any user who owns games but has never rated something they do not own — a very common case. That exception propagates through `Promise.all` and kills the entire fetch, so users with a perfectly valid owned collection cannot load at all.

The intent of the "throw on 0 games" guard (from CLAUDE.md) is to prevent writing an empty result to localStorage on a 202 timeout; it should not block a legitimately empty secondary query.

**Fix:** Accept an empty result from `parseCollectionXml` for the rated-unowned query, or add a separate lenient parser variant. The simplest fix is to make the throw optional or to handle the empty-collection case in `fetchCollection` itself:

```ts
// In bggClient.ts — replace the parseCollectionXml call for the secondary query

function parseCollectionXmlOrEmpty(xmlText: string): RawGame[] {
  try {
    return parseCollectionXml(xmlText)
  } catch (e) {
    if (e instanceof Error && e.message.includes('0 games')) return []
    throw e
  }
}

// In fetchCollection:
const owned = parseCollectionXml(ownedXml)          // still throws on 0 owned games
const ratedUnowned = parseCollectionXmlOrEmpty(ratedXml)  // empty is valid here
```

Alternatively, refactor `parseCollectionXml` to accept a `{ requireNonEmpty: boolean }` option and pass `false` for the rated query.

---

### CR-02: `pick()` re-presents the same skipped pair immediately after it is picked

**File:** `src/store/store.ts:270-283`

**Issue:** When the skip queue is non-empty, `selectRandomPair` returns `skipQueue[0]` — meaning the currently displayed pair IS `skipQueue[0]`. Inside `pick()`:

```ts
const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
const nextPair =
  skipQueue.length > 0 ? skipQueue[0] : selectRandomPair(newRatings, [])
```

`newQueue` correctly drops the front element (`skipQueue.slice(1)`), but `nextPair` is set to `skipQueue[0]` — the very element that was just consumed (picked). The user picks a winner from the currently-displayed pair, and the next pair displayed is that same comparison again. The rating update is applied correctly, but the UX is broken: a freshly-decided pair re-appears for another decision.

The fix is to advance to `skipQueue[1]` (now `newQueue[0]`) or fall back to random selection:

```ts
// store.ts pick() — corrected next-pair selection
const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
const nextPair =
  newQueue.length > 0
    ? newQueue[0]                          // next item after the one just consumed
    : selectRandomPair(newRatings, [])     // no more skips → random
set({
  ratings: newRatings,
  comparisonsTotal: comparisonsTotal + 1,
  sessionComparisons: sessionComparisons + 1,
  currentPair: nextPair,
  skipQueue: newQueue,
})
```

---

## Warnings

### WR-01: `skip()` ignores the existing skip queue when choosing the next random pair

**File:** `src/store/store.ts:285-293`

**Issue:** After appending the current pair to the skip queue, `skip()` calls `selectRandomPair(ratings, [])` with an empty queue. `selectRandomPair` only uses its second argument to serve queued pairs first; by always passing `[]`, `skip()` bypasses the drain semantics entirely. More importantly, the random selection has no awareness of what is already in the skip queue, so a just-skipped pair can be immediately re-selected as the next pair.

While the queued pair will be served before any random pair on the next `pick()` call, showing it again right after skipping it is confusing UX and contradicts skip semantics.

**Fix:** Pass the updated skip queue so the drain logic takes precedence, or filter the randomly selected pair to avoid entries already in the queue:

```ts
skip(): void {
  const { currentPair, skipQueue, ratings } = get()
  if (!currentPair) return
  const newQueue = [...skipQueue, currentPair]
  // Drain from queue if it has items; otherwise pick randomly
  set({
    skipQueue: newQueue,
    currentPair: selectRandomPair(ratings, newQueue),
  })
},
```

---

### WR-02: `VITE_BGG_API_BASE` is cast as `string` but is `undefined` when the env var is absent

**File:** `src/api/bggClient.ts:11`

**Issue:** `import.meta.env.VITE_BGG_API_BASE as string` casts away a potentially `undefined` value. In `.env.production` the variable is set to an empty string (intentional for Cloudflare Worker deployment), but if the file is missing or the variable is omitted, `BGG_API_BASE` will be `undefined`. URL construction (`${BGG_API_BASE}/xmlapi2/collection?...`) will silently produce `"undefined/xmlapi2/collection?..."`, resulting in 404s that surface as confusing BGG API errors rather than a configuration failure.

**Fix:** Add a startup assertion or use nullish coalescing with an explicit fallback:

```ts
export const BGG_API_BASE: string = import.meta.env.VITE_BGG_API_BASE ?? ''

// Optional: add a dev-time guard
if (import.meta.env.DEV && BGG_API_BASE === '') {
  console.warn('[bggClient] VITE_BGG_API_BASE is not set — API calls will fail in dev mode')
}
```

---

### WR-03: `fetchCollection` action in the store does not reset `sessionComparisons` on a capacity-exceeded error path

**File:** `src/store/store.ts:171-189`

**Issue:** When `validateTierCapacity` throws (the user's collection exceeds 990 games), the code sets `view: 'error'` and returns. However, the prior `set()` call on lines 163-169 already set `sessionUsername: username` and `view: 'loading'`. When the error path fires, `sessionComparisons` is not reset. If the user previously had a session and `resetForNewUser()` was not called, stale `sessionComparisons` from a prior session could leak through if the error view somehow transitions to comparison (e.g., via `continueSession`).

More concretely: the `rankingsUsername` is NOT updated on the capacity-error path (correct), but `sessionUsername` IS set to the new (over-capacity) username. If the user then presses a browser back button or invokes `continueSession()` (possible from `UsernameEntry` if the continue prompt is still visible), they enter comparison mode for a different user's session than what `rankingsUsername` reflects.

**Fix:** Clear `sessionUsername` in the capacity-error `set()` call, or ensure the error view provides no path to `continueSession`:

```ts
set({
  view: 'error',
  errorMessage:
    'Your collection has ' + e.gameCount + ' games, which exceeds the 990-game limit. Remove some games from your BGG collection and try again.',
  sessionUsername: null,  // prevent stale session cross-contamination
})
return
```

---

### WR-04: `UsernameEntry` shows the "Re-fetch collection" button but calls `resetForNewUser()` which clears all data without re-fetching

**File:** `src/components/UsernameEntry.tsx:80-87`

**Issue:** The "Re-fetch collection" button label implies the application will fetch fresh data from BGG. However, `resetForNewUser()` only clears all state and returns to the `entry` view — it does not trigger a fetch. The user must then re-type their username and submit the form to actually re-fetch. The label is misleading and could cause confusion (user clicks "Re-fetch collection" expecting a network request, sees a blank form instead).

**Fix:** Either rename the button to "Start over" / "Clear rankings" to accurately describe what it does, or wire it to call `fetchCollection(sessionUsername)` directly after resetting state to trigger the actual re-fetch.

```tsx
// Option A — honest label
<button type="button" onClick={resetForNewUser}>
  Start over
</button>

// Option B — perform actual re-fetch
const handleRefetch = () => {
  resetForNewUser()
  if (sessionUsername) fetchCollection(sessionUsername)
}
<button type="button" onClick={handleRefetch}>
  Re-fetch collection
</button>
```

---

## Info

### IN-01: `parseCollectionXml` error message couples implementation detail into user-facing copy

**File:** `src/api/bggClient.ts:76` and `src/store/store.ts:233`

**Issue:** `parseCollectionXml` throws `'BGG returned 0 games — not writing to localStorage'`. The store catches this and (line 233) checks `message.includes('0 games')` then passes the raw message through as `errorMessage`. Users see the implementation note "not writing to localStorage" in the error UI, which is not meaningful to them.

**Fix:** Use a user-friendly message constant and keep the internal note in comments only:

```ts
// bggClient.ts
throw new Error('BGG returned an empty collection for this username.')

// store.ts — update the catch guard if needed
} else if (message.includes('empty collection')) {
  errorMessage = message  // already user-friendly
}
```

---

### IN-02: `getRankPosition` in `GameCard.tsx` sorts all ratings on every render

**File:** `src/components/GameCard.tsx:8-11`

**Issue:** `getRankPosition` creates and sorts a full copy of the ratings entries on every render. With the 990-game ceiling this is bounded, but the sort runs twice per comparison render (once per `GameCard`) and once more whenever any state change re-renders either card. The result is not memoized.

While O(n log n) performance at n=990 is not a correctness issue, the function is declared outside the component and receives fresh data each call with no caching, which is an easily avoided waste.

**Fix:** Wrap the sort in `useMemo` inside the component, keyed on `ratings`:

```tsx
const rank = useMemo(
  () => getRankPosition(gameId, ratings),
  [gameId, ratings]
)
```

---

_Reviewed: 2026-05-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
