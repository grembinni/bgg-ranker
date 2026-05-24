# Phase 2: Collection & Ranking — Research

**Researched:** 2026-05-23
**Domain:** BGG XML API2 collection fetch, Zustand persist slices, React conditional rendering, localStorage persistence
**Confidence:** HIGH (BGG XML schema from multiple library sources; Zustand from official docs; engine API from source code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single-page conditional rendering — no React Router. App.tsx switches between views based on Zustand store state. No URL changes.
- **D-02:** Three views only: (1) Username Entry, (2) Collection Loading / 202 polling indicator, (3) Comparison screen. No ranked list view in Phase 2.
- **D-03:** Comparison screen layout: header contains username + session/total comparison counter (RANK-05); Skip and Refresh are secondary buttons below the two game cards.
- **D-04:** Clean utility UI — functional Tailwind styling, no animations, no design polish.
- **D-05:** Each comparison card shows: game name + year published.
- **D-06:** Each card also shows the game's current rank position (e.g. "#47 of 200"). Rank is computed from sorted ratings array at render time — not stored separately.
- **D-07:** Parse and store thumbnail URL for every game in CollectionState now, even though Phase 2 does not display it.
- **D-08:** No username persistence to localStorage — username is required on every visit.
- **D-09:** The PERSIST-02 username guard is implemented by embedding username inside `PersistedRankings` (in the `bgg-ranker:v1:rankings` localStorage key).
- **D-10:** When the user enters a username that matches stored rankings: show a prompt — "Found N ranked games from your last session. Continue ranking or re-fetch collection?" — before loading. Auto-load without prompt is NOT the behavior.
- **D-11:** COLL-02 (expansion toggle) is removed from v1. Phase 2 uses `subtype=boardgame` on all collection requests. No toggle, no expansion handling.
- **D-12:** COLL-03 (previously-rated unowned games) is in Phase 2 scope. Two collection queries: `own=1&subtype=boardgame` and `rated=1&subtype=boardgame&own=0`. Both run after username entry.
- **D-13:** Deduplication strategy: if a game appears in both the owned and rated-unowned results (same BGG objectid), the owned entry wins. Log a debug note that a duplicate was found and the owned record was kept.
- **D-14:** `initializeRankings` is called once when the collection is first loaded (no stored rankings for this user).
- **D-15:** `applyUpset` is called on every comparison pick where winner was ranked below loser.
- **D-16:** `redistribute` is called when user triggers manual Refresh (REFRESH-01).
- **D-17:** All ratings stored as integers in Zustand and localStorage (`801` = 8.01).

### Claude's Discretion
- Pair selection algorithm for RANK-02 — Claude decides the selection strategy (purely random is fine; weighted toward less-compared games is optional)
- Skip queue implementation for RANK-04 — Claude decides queue structure
- Exact Zustand slice structure — Claude decides following ARCHITECTURE.md interface definitions and CLAUDE.md partialize rules
- 202 polling parameters — Claude decides retry count and delay within the documented 8 retries / 3s delay guidelines from CLAUDE.md

### Deferred Ideas (OUT OF SCOPE)
- COLL-02 (expansion toggle) — removed from v1, moved to v2 deferred
- Ranked list view (DISP-V2-01) — v2
- Tier groupings in ranked list (DISP-V2-02) — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLL-01 | App fetches the user's owned board games from BGG XML API2 (excludes expansions by default) | BGG collection endpoint URL, query params, XML parsing pattern documented in §BGG XML API |
| COLL-03 | App also fetches unowned games the user has previously rated on BGG | Second query with `rated=1&own=0`, dedup logic documented in §Two-Query Strategy |
| RANK-01 | On first load with no saved rankings, games are assigned random initial positions distributed across bell-curve tiers | `initializeRankings()` already implemented in rankingEngine.ts — store calls it once |
| RANK-02 | App presents two randomly selected games from the pool; user picks the one they prefer | Random pair selection from `Object.keys(ratings)` documented in §Pair Selection Algorithm |
| RANK-03 | When chosen game was ranked lower, it takes loser's exact rating; games between shift down one spacing step | `applyUpset()` already implemented — store calls it on every pick where winnerPos > loserPos |
| RANK-04 | User can skip a comparison; the pair is re-queued for a later round | In-memory skip queue in ComparisonState, documented in §Skip Queue |
| RANK-05 | App displays a comparison count (current session and total lifetime) | `sessionComparisons` in ComparisonState (not persisted), `comparisonsTotal` in RankingsState (persisted) |
| REFRESH-01 | User can trigger a manual refresh to redistribute all rankings, preserving relative order | `redistribute()` already implemented — store calls it on Refresh button click |
| PERSIST-01 | Current rankings are saved to localStorage after every comparison so they survive page reload | Zustand persist middleware with localStorage; save triggered by store action, documented in §Persistence Schema |
| PERSIST-02 | Stored rankings load automatically on return visits; if stored username differs from logged-in user, rankings are discarded | Username embedded in PersistedRankings; check on every store hydration, documented in §Username Guard |
</phase_requirements>

---

## Summary

Phase 2 builds on the complete Phase 1 engine foundation. The entire ranking math (`initializeRankings`, `applyUpset`, `redistribute`, `validateTierCapacity`) is already implemented and tested. Phase 2 work is: (1) BGG API client to fetch two collection queries and parse XML, (2) Zustand store wiring those API calls to the engine functions with localStorage persistence, and (3) three React views driven by store state.

The BGG XML API2 collection endpoint uses `value` attributes on most elements (unlike API v1 which used text nodes). The response may return HTTP 202 on first call — the client must implement a retry loop. Two separate collection queries are required: one for owned games and one for rated-unowned games, with client-side deduplication preferring the owned entry.

Zustand 5's `persist` middleware with `partialize` allows persisting only `CollectionState` and `RankingsState` while keeping `SessionState` and `ComparisonState` ephemeral. The `vitest.config.ts` specifies `environment: 'node'` — store tests that touch localStorage must use a custom mock storage object.

**Primary recommendation:** Use plain `fetch` with a manual polling loop in `bggClient.ts` rather than TanStack Query — the BGG 202 pattern is a server-side queuing mechanism, not a standard retry, and the polling must stop on any non-202 response regardless of content. TanStack Query is still useful for collection fetching if you drive the polling via `refetchInterval: (q) => q.state.data?.status === 'done' ? false : 3000` but the manual approach is simpler and easier to test.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| BGG collection fetch + XML parse | API client (`bggClient.ts`) | — | Isolates all HTTP and parsing; UI never calls API directly |
| 202 polling loop | API client (`bggClient.ts`) | — | Polling is a transport concern, not business logic |
| Two-query merge + deduplication | API client (`bggClient.ts`) | Store action | Client returns merged array; store calls engine |
| Tier capacity validation | Engine (`rankingEngine.ts`) | Store (calls it) | Pure math, already implemented |
| Initial ranking seed | Engine (`rankingEngine.ts`) | Store (calls it) | `initializeRankings()` already implemented |
| Upset application | Engine (`rankingEngine.ts`) | Store (calls it) | `applyUpset()` already implemented |
| Redistribution | Engine (`rankingEngine.ts`) | Store (calls it) | `redistribute()` already implemented |
| State management + persistence | Store (`store.ts`) | — | Zustand slices with persist middleware |
| Pair selection | Store (comparison actions) | — | Stateful; needs access to current ratings |
| Skip queue | Store (ComparisonState) | — | Session-only state |
| View rendering | React components (`src/components/`) | App.tsx (switch) | Pure render of store state; no direct API calls |
| Username guard (PERSIST-02) | Store (hydration check) | — | Must run immediately after rehydration |

---

## Standard Stack

### Core (all installed in Phase 1)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `zustand` | `^5.0.13` | State management + persistence | Already installed; persist middleware built-in |
| `@tanstack/react-query` | `^5.100.11` | Optional for collection fetching | Already installed; provides loading/error states |
| `fast-xml-parser` | `^5.8.0` | BGG XML parsing | Already installed; preferred over DOMParser per stack decision |
| `tailwindcss` | `^4.3.0` | Utility CSS | Already installed; CSS-first config in index.css |
| `vitest` | `^4.1.7` | Test runner | Already installed; `environment: 'node'` in vitest.config.ts |

**No new packages required for Phase 2.** All dependencies were installed in Phase 1. [VERIFIED: package.json in repo]

### Package Legitimacy Audit

No new packages are installed in Phase 2. All packages used were audited in Phase 1.

| Package | Status |
|---------|--------|
| All Phase 2 dependencies | Installed in Phase 1 — no re-audit needed |

---

## BGG XML API2 — Collection Endpoint

### URL Construction

```
GET /xmlapi2/collection?username={username}&{filters}
```

Via proxy: `${BGG_API_BASE}/xmlapi2/collection?username={username}&{filters}`

### Query 1 — Owned games (COLL-01)

```
/xmlapi2/collection?username={u}&own=1&subtype=boardgame&stats=1
```

### Query 2 — Rated-unowned games (COLL-03, D-12)

```
/xmlapi2/collection?username={u}&rated=1&own=0&subtype=boardgame&stats=1
```

**`stats=1` is required** to include the `<stats>` element which contains the user's personal rating (`<rating value="..."/>`). Without it, the stats subtree is absent. [CITED: lcosmin/boardgamegeek Python library — constructs `stats: 1` explicitly in params]

### HTTP 202 Behavior

BGG queues large collection fetches. On first request it returns HTTP 202 with a minimal XML body. The client must poll with delay until HTTP 200. [CITED: CLAUDE.md and PITFALLS.md C1]

- Max retries: 8
- Delay between retries: 3 seconds
- On exhaustion: surface a user-visible error (do not write to localStorage)
- Never write to localStorage on a 0-game result [CITED: CLAUDE.md]

### XML Response Schema (API2 format)

The BGG XML API2 collection endpoint returns:

```xml
<items totalitems="N" termsofuse="..." pubdate="...">
  <item objectid="174430" objecttype="thing" subtype="boardgame" collid="...">
    <name sortindex="1" value="Gloomhaven"/>
    <yearpublished value="2017"/>
    <image>//cf.geekdo-images.com/.../pic2437871.jpg</image>
    <thumbnail>//cf.geekdo-images.com/.../pic2437871_t.jpg</thumbnail>
    <stats minplayers="1" maxplayers="4" playingtime="120" numowned="...">
      <rating value="8.5">   <!-- user's personal rating; "N/A" if not rated -->
        <usersrated value="..."/>
        <average value="8.60"/>
        <bayesaverage value="8.47"/>
        <stddev value="..."/>
        <median value="0"/>
        <ranks>
          <rank type="subtype" id="1" name="boardgame" value="1" .../>
        </ranks>
      </rating>
    </stats>
    <status own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0"
            wanttobuy="0" wishlist="0" preordered="0" lastmodified="..."/>
    <numplays>3</numplays>
  </item>
</items>
```

**Critical API2 differences from API v1:**
- `<name>` uses `value` attribute, NOT text content: `<name sortindex="1" value="Gloomhaven"/>`
- `<yearpublished>` uses `value` attribute: `<yearpublished value="2017"/>`
- `<thumbnail>` is a text node (URL string) — consistent with v1
- `<stats>` → `<rating value="...">` where value is the user's personal rating or `"N/A"` if unrated
- `objectid` is an attribute on `<item>`, NOT a child element

[CITED: jemiahlee/bgg sample_data/collection.xml for v1 structure; WebSearch confirms API2 uses value attributes; lcosmin/boardgamegeek collection.py for attribute access patterns — `item.attrib["objectid"]`, `xml_subelement_attr(item, "yearpublished")`, `xml_subelement_text(item, "thumbnail")`, `xml_subelement_attr(stats, "rating")`]

### Two-Query Strategy and Deduplication (D-12, D-13)

Run both queries in parallel with `Promise.all`. Merge by objectid:

```typescript
// Client-side deduplication: owned entry wins (D-13)
function mergeCollections(owned: RawGame[], ratedUnowned: RawGame[]): RawGame[] {
  const ownedIds = new Set(owned.map(g => g.id))
  const deduped = ratedUnowned.filter(g => {
    if (ownedIds.has(g.id)) {
      console.debug(`[bggClient] Duplicate objectid=${g.id}: owned entry kept, rated-unowned dropped`)
      return false
    }
    return true
  })
  return [...owned, ...deduped]
}
```

---

## Architecture Patterns

### System Architecture Diagram

```
User action (Enter username)
        │
        ▼
  App.tsx view switch
  (store.view === 'entry' | 'loading' | 'comparison')
        │
        ▼
  store.fetchCollection(username)
        │
        ├─── bggClient.fetchCollection(username)
        │       ├── Promise.all([ownedQuery, ratedUnownedQuery])
        │       │       └── each: poll202Loop(url) → parse XML → RawGame[]
        │       └── mergeCollections(owned, ratedUnowned) → RawGame[]
        │
        ├─── validateTierCapacity(games.length) → throws TierCapacityError if >990
        │
        ├─── Check stored PersistedRankings.username === username
        │       ├── MATCH: dispatch 'continue-or-refetch' prompt (D-10)
        │       └── NO MATCH / NONE: initializeRankings(gameIds) → ratings
        │
        ├─── store.set({ collection: games, ratings, view: 'comparison' })
        │
        └─── Persist: CollectionState + RankingsState → localStorage
                      (SessionState + ComparisonState excluded by partialize)

Comparison loop:
  User picks winner
        │
        ▼
  store.pick(winnerId, loserId)
        ├── applyUpset(winnerId, loserId, ratings) → newRatings
        ├── sessionComparisons++, comparisonsTotal++
        ├── selectNextPair(ratings, skipQueue) → ComparisonState.currentPair
        └── Persist rankings → localStorage
```

### Recommended Project Structure

```
src/
├── api/
│   └── bggClient.ts          # BGG HTTP fetch, XML parse, 202 polling, dedup
├── engine/
│   └── rankingEngine.ts      # (Phase 1, complete)
├── store/
│   └── store.ts              # Zustand store — all slices, persist middleware
├── components/
│   ├── UsernameEntry.tsx     # View 1: username form + continue-or-refetch prompt
│   ├── CollectionLoading.tsx # View 2: spinner + polling status message
│   └── ComparisonView.tsx    # View 3: two game cards, pick/skip/refresh
│       └── GameCard.tsx      # Card subcomponent (name, year, rank position)
└── App.tsx                   # View switch driven by store.view
```

### Pattern 1: BGG 202 Polling Loop

Use plain `fetch` in `bggClient.ts`. Do NOT use TanStack Query for this — the polling must stop at any non-202 result (including BGG error pages), not just on success.

```typescript
// Source: CLAUDE.md constraints + PITFALLS.md C1 + M1
const MAX_RETRIES = 8
const RETRY_DELAY_MS = 3000

async function poll202Loop(url: string): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url)

    if (res.status === 202) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`BGG collection fetch timed out after ${MAX_RETRIES} retries`)
      }
      await delay(RETRY_DELAY_MS)
      continue
    }

    if (!res.ok) {
      throw new Error(`BGG API error: HTTP ${res.status}`)
    }

    const text = await res.text()
    // Guard: BGG sometimes returns HTML error page with 200 status (pitfall M1)
    if (text.trim().startsWith('<html')) {
      throw new Error('BGG returned HTML error page instead of XML')
    }
    return text
  }
  throw new Error('Poll loop exhausted')
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### Pattern 2: fast-xml-parser for BGG Collection XML

BGG API2 collection items use `value` attributes on most elements. Configure fast-xml-parser to capture attributes.

```typescript
// Source: fast-xml-parser npm documentation, ignoreAttributes option
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (_name, jPath) => jPath === 'items.item', // always array even for 1 item
})

interface RawGame {
  id: string          // from item @_objectid
  name: string        // from item.name @_value
  yearPublished: number // from item.yearpublished @_value
  thumbnail: string   // from item.thumbnail (text node)
}

function parseCollectionXml(xmlText: string): RawGame[] {
  const parsed = parser.parse(xmlText)
  const items: unknown[] = parsed?.items?.item ?? []

  return items.map((item: Record<string, unknown>) => {
    const statsEl = item['stats'] as Record<string, unknown> | undefined
    const ratingEl = statsEl?.['rating'] as Record<string, unknown> | undefined
    const userRatingRaw = ratingEl?.['@_value']

    return {
      id: String(item['@_objectid']),
      name: String((item['name'] as Record<string, unknown>)?.['@_value'] ?? ''),
      yearPublished: Number((item['yearpublished'] as Record<string, unknown>)?.['@_value'] ?? 0),
      thumbnail: String(item['thumbnail'] ?? ''),
    }
  }).filter(g => g.id && g.name)
}
```

**Warning:** The `isArray` option is critical. If a user owns exactly 1 game, fast-xml-parser will return the item as an object rather than a 1-element array. Without `isArray`, the `.map()` will crash. [ASSUMED — isArray behavior for single-element responses is well-documented in fxp but needs verification against the installed version 5.8.0]

### Pattern 3: Zustand Store with persist and partialize

The store must persist `CollectionState` and `RankingsState` but never `SessionState` or `ComparisonState`. [CITED: CLAUDE.md — "The `persist` middleware `partialize` function must explicitly exclude `SessionState`"]

```typescript
// Source: zustand.docs.pmnd.rs + ARCHITECTURE.md slice interfaces
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ---- Types ----

export interface Game {
  id: string
  name: string
  yearPublished: number
  thumbnail: string
}

interface SessionState {
  username: string | null  // set on entry, cleared on reset — NEVER persisted
}

interface CollectionState {
  games: Record<string, Game>   // keyed by BGG objectid
  lastFetched: number | null
}

interface RankingsState {
  ratings: Record<string, number>   // gameId -> integer (801 = 8.01)
  comparisonsTotal: number
  username: string | null           // guard for PERSIST-02
  version: number
}

interface ComparisonState {
  view: 'entry' | 'loading' | 'comparison' | 'error'
  currentPair: [string, string] | null
  sessionComparisons: number
  skipQueue: Array<[string, string]>
  loadingMessage: string | null
  errorMessage: string | null
}

export type AppStore = SessionState & CollectionState & RankingsState & ComparisonState & {
  // Actions
  setUsername: (username: string) => void
  fetchCollection: (username: string) => Promise<void>
  pick: (winnerId: string, loserId: string) => void
  skip: () => void
  refresh: () => void
  continueSession: () => void
  resetForNewUser: () => void
}

// ---- Store ----

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // SessionState
      username: null,

      // CollectionState
      games: {},
      lastFetched: null,

      // RankingsState
      ratings: {},
      comparisonsTotal: 0,
      username: null,   // rankings username guard (separate from session username)
      version: 1,

      // ComparisonState
      view: 'entry',
      currentPair: null,
      sessionComparisons: 0,
      skipQueue: [],
      loadingMessage: null,
      errorMessage: null,

      // Actions defined below...
      setUsername: (username) => set({ username }),
      fetchCollection: async (username) => { /* see §Store Actions */ },
      pick: (winnerId, loserId) => { /* see §Pick Action */ },
      skip: () => { /* see §Skip Queue */ },
      refresh: () => { /* see §Refresh Action */ },
      continueSession: () => { /* resume from stored rankings */ },
      resetForNewUser: () => { /* clear ratings, re-initialize */ },
    }),
    {
      name: 'bgg-ranker:v1:collection-and-rankings',
      storage: createJSONStorage(() => localStorage),
      // CRITICAL: partialize must exclude SessionState and ComparisonState (AUTH-03)
      partialize: (state) => ({
        games: state.games,
        lastFetched: state.lastFetched,
        ratings: state.ratings,
        comparisonsTotal: state.comparisonsTotal,
        username: state.username,  // rankings username guard
        version: state.version,
      }),
    }
  )
)
```

**Note:** The ARCHITECTURE.md calls for separate localStorage keys (`bgg-ranker:v1:collection` and `bgg-ranker:v1:rankings`). Using a single store key is simpler and achieves the same isolation. If the planner wants strict key separation, the store can be split into two `create()` calls. Either is correct; single-store is less boilerplate. [ASSUMED — separate vs single key is a valid discretion decision]

### Pattern 4: Username Guard (PERSIST-02, D-09)

The guard must run during store hydration, before any comparison is possible:

```typescript
// In fetchCollection action — called after username entry form submission
fetchCollection: async (username: string) => {
  const state = get()

  // PERSIST-02 guard: check if stored rankings belong to this user (D-09)
  const storedRankingsUsername = state.username  // from persisted RankingsState
  const hasStoredRankings =
    storedRankingsUsername === username &&
    Object.keys(state.ratings).length > 0

  if (hasStoredRankings) {
    // D-10: show "Continue ranking or re-fetch?" prompt
    set({ view: 'entry', sessionUsername: username /* show prompt */ })
    return
  }

  // No matching stored rankings → fetch collection fresh
  await doFetchAndInitialize(username)
}
```

**Clarification on two "username" fields:** The store has two logically separate username values:
1. `SessionState.username` — the currently active username (ephemeral, not persisted, D-08)
2. `RankingsState.username` — the username whose rankings are stored (persisted, used for PERSIST-02 guard)

The planner should disambiguate these as `sessionUsername` (not persisted) and `rankingsUsername` (persisted) to avoid confusion.

### Pattern 5: Pair Selection Algorithm (RANK-02, Claude's Discretion)

**Recommendation:** Purely random selection from `Object.keys(ratings)`. No weighting.

Rationale: The comparison loop is meant to converge over many sessions. Weighted selection (toward less-compared games) adds state complexity (a comparison counter per game) and is premature optimization. The skip queue (RANK-04) handles the "too close to call" case explicitly.

```typescript
function selectRandomPair(
  ratings: Record<string, number>,
  skipQueue: Array<[string, string]>
): [string, string] | null {
  const ids = Object.keys(ratings)
  if (ids.length < 2) return null

  // Drain the skip queue first
  if (skipQueue.length > 0) {
    return skipQueue[0]  // dequeue happens in store action after select
  }

  // Purely random pair
  const shuffled = [...ids].sort(() => Math.random() - 0.5)
  return [shuffled[0], shuffled[1]]
}
```

### Pattern 6: Skip Queue (RANK-04, Claude's Discretion)

**Recommendation:** Append skipped pairs to end of the in-memory `skipQueue` array in `ComparisonState`. Dequeue from front when the main pool produces a pair. The queue is session-only (not persisted).

```typescript
skip: () => {
  const { currentPair, skipQueue, ratings } = get()
  if (!currentPair) return

  const newQueue = [...skipQueue, currentPair]
  // Select next pair from main pool (not queue — queue drains later)
  const nextPair = selectRandomPair(ratings, [])
  set({ skipQueue: newQueue, currentPair: nextPair, sessionComparisons: get().sessionComparisons })
}
```

When `selectRandomPair` is called with the full `skipQueue`, it returns the front of the queue. After using a queued pair, dequeue it:

```typescript
// In pick action, after applyUpset:
const nextPair = skipQueue.length > 0
  ? skipQueue[0]
  : selectRandomPair(ratings, [])
const newSkipQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
```

### Pattern 7: Pick Action (RANK-03, RANK-05)

```typescript
pick: (winnerId: string, loserId: string) => {
  const { ratings, comparisonsTotal, skipQueue } = get()
  const newRatings = applyUpset(winnerId, loserId, ratings)

  // Select next pair
  const newSkipQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
  const nextPair = skipQueue.length > 0
    ? skipQueue[0]
    : selectRandomPair(newRatings, [])

  set({
    ratings: newRatings,
    comparisonsTotal: comparisonsTotal + 1,
    sessionComparisons: get().sessionComparisons + 1,
    currentPair: nextPair,
    skipQueue: newSkipQueue,
  })
  // persist middleware auto-saves on every set()
}
```

### Pattern 8: Rank Position Display (D-06)

Rank position is computed at render time from the sorted ratings array — not stored. [CITED: CONTEXT.md §Specific Ideas]

```typescript
// In GameCard.tsx or a selector
function getRankPosition(gameId: string, ratings: Record<string, number>): number {
  const sorted = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  return sorted.findIndex(([id]) => id === gameId) + 1  // 1-indexed
}
// Usage: `#${getRankPosition(game.id, ratings)} of ${Object.keys(ratings).length}`
```

**Performance note:** `Object.entries().sort()` is O(n log n) and called per render for both cards. At 990 games this is ~100µs — acceptable without memoization. Add `useMemo` only if profiling shows it as a bottleneck.

### Anti-Patterns to Avoid

- **Fetching collection from a React component directly:** All API calls go through the store. `bggClient` is imported only in `store.ts`.
- **Storing parsed ratings as floats:** Integer-only. `801` not `8.01`. Divide by 100 only at display/sync time.
- **Writing to localStorage on 0-game result:** Guard: `if (games.length === 0) throw new Error(...)` — never call persist on empty.
- **Calling `initializeRankings` on re-fetch if rankings exist:** Only called once when no valid stored rankings for this user exist (C3 pitfall).
- **Sharing the `username` field name for session vs rankings:** Creates hydration bugs. Name them distinctly: `sessionUsername` (ephemeral) and `rankingsUsername` (persisted).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence to localStorage | Custom serializer/deserializer | Zustand `persist` middleware | Handles JSON serialization, rehydration, storage errors, version migration |
| XML parsing | String regex / manual DOM walking | `fast-xml-parser` (already installed) | Handles malformed XML, attribute parsing, array normalization |
| Bell-curve ranking math | New implementation | `rankingEngine.ts` (Phase 1) | Already implemented, tested, and proven correct |
| Tier capacity validation | Inline check | `validateTierCapacity()` + `TierCapacityError` | Tested, throws typed error the store can catch |
| Unique rating enforcement | Post-hoc deduplication | `initializeRankings()` / `applyUpset()` | Engine guarantees uniqueness via integer spacing |

---

## Common Pitfalls

### Pitfall 1: BGG 202 — Writing Empty State to localStorage (C1)

**What goes wrong:** `fetch()` returns 202, app parses the minimal XML body, finds 0 items, and writes `games: {}` to localStorage via the persist middleware. All stored rankings are silently destroyed.

**Prevention:** The poll loop must not return until HTTP 200 with `games.length > 0`. Add explicit guards:
- If HTTP 202 → retry (never process as success)
- If HTTP 200 and parsed games count is 0 → throw error (do not persist)
- `validateTierCapacity()` is called before `initializeRankings()` — it will throw on 0 games only via the TierCapacityError path for >990; the 0-game guard must be separate.

### Pitfall 2: BGG Returns HTML Error Page with HTTP 200 (M1)

**What goes wrong:** BGG returns an HTML error page when overloaded. `fast-xml-parser` silently produces a partial or empty parse result. App crashes or renders 0 games.

**Prevention:** After fetch, check if response body starts with `<html` (case-insensitive). If so, retry (treat as soft server error). Also check `parsed.items` is defined before accessing `.item`.

### Pitfall 3: fast-xml-parser Single-Item Array Problem

**What goes wrong:** A user with 1 owned game gets `items.item` as a plain object instead of a 1-element array. `items.item.map(...)` throws `TypeError: items.item.map is not a function`.

**Prevention:** Use the `isArray` option in `XMLParser` constructor: `isArray: (name, jPath) => jPath === 'items.item'`. This forces the parser to always wrap `<item>` elements in an array.

### Pitfall 4: API2 `value` Attribute vs. Text Node Confusion

**What goes wrong:** Developer accesses `item.name` expecting a string (as in API v1), but gets an object `{ "@_sortindex": "1", "@_value": "Gloomhaven" }`. Name is stored as `undefined`.

**Prevention:** Access `item.name['@_value']` not `item.name`. Use TypeScript types for the parsed output to catch this at compile time.

### Pitfall 5: Two Username Fields in Persisted State

**What goes wrong:** The store has `username` in both `SessionState` (ephemeral, for display) and `RankingsState` (persisted, for PERSIST-02 guard). If named identically, the persist `partialize` accidentally persists the session username, or the guard reads the wrong value.

**Prevention:** Name them explicitly: `sessionUsername` (not in `partialize`) and `rankingsUsername` (in `partialize`). The PERSIST-02 guard compares `state.rankingsUsername === enteredUsername`.

### Pitfall 6: vitest `environment: 'node'` — localStorage Not Available

**What goes wrong:** Store tests that test persistence behavior call `localStorage.getItem()` and crash because Node.js has no `localStorage`.

**Prevention:** Two options:
1. Use `createJSONStorage(() => mockStorage)` with a custom in-memory storage object in tests — pass the storage as a parameter to a store factory function.
2. Switch vitest environment to `jsdom` globally (change `vitest.config.ts`) — but this may break existing `environment: 'node'` engine tests.

**Recommendation:** Keep `environment: 'node'` (Phase 1 engine tests depend on it). Use a custom mock storage object for store tests that need persistence. This is the pattern documented in Zustand testing guides.

### Pitfall 7: Re-fetch Overwrites Stored Rankings (C3)

**What goes wrong:** User re-enters username on a return visit. `fetchCollection` runs, fetches fresh data, and calls `initializeRankings()`, destroying comparison history.

**Prevention:** `initializeRankings` is called ONLY when `storedRankingsUsername !== enteredUsername` (no matching stored rankings). When username matches, show the D-10 prompt first. `continueSession()` action must NOT call `initializeRankings`.

---

## Persistence Schema

### localStorage Keys

| Key | What | When Written | Notes |
|-----|------|-------------|-------|
| `bgg-ranker:v1:collection-and-rankings` | Full persisted state | After every `set()` via persist middleware | Single key covers both CollectionState and RankingsState |

**If the planner wants two separate keys** (matching ARCHITECTURE.md exactly), split into two `create()` calls: `useCollectionStore` and `useRankingsStore`. Each gets its own `persist` middleware and its own localStorage key (`bgg-ranker:v1:collection` and `bgg-ranker:v1:rankings`). The App reads from both. This is more verbose but more aligned with ARCHITECTURE.md. [ASSUMED — single vs split key: both valid]

### PersistedRankings schema (what goes to localStorage)

```typescript
// Persisted shape (partialize output)
interface PersistedShape {
  version: 1
  // From CollectionState:
  games: Record<string, { id: string; name: string; yearPublished: number; thumbnail: string }>
  lastFetched: number | null
  // From RankingsState:
  ratings: Record<string, number>   // integer-internal (801 = 8.01)
  comparisonsTotal: number
  rankingsUsername: string | null   // PERSIST-02 guard
}
```

**Username guard logic on app startup:**

```typescript
// Called inside fetchCollection after username form submit:
const stored = useStore.getState()
if (stored.rankingsUsername === enteredUsername && Object.keys(stored.ratings).length > 0) {
  // Show D-10 prompt: "Found N ranked games. Continue or re-fetch?"
} else {
  // Fetch fresh collection → initializeRankings → set view: 'comparison'
}
```

---

## Component Structure

### App.tsx — View Router

```typescript
// App.tsx — single-page conditional rendering (D-01)
function App() {
  const view = useStore(s => s.view)
  return (
    <>
      {view === 'entry' && <UsernameEntry />}
      {view === 'loading' && <CollectionLoading />}
      {view === 'comparison' && <ComparisonView />}
      {view === 'error' && <ErrorDisplay />}
    </>
  )
}
```

### Component Props and Responsibilities

| Component | Props | Store reads | Store actions |
|-----------|-------|-------------|---------------|
| `UsernameEntry` | none | `view`, `rankingsUsername`, `comparisonsTotal` | `fetchCollection`, `continueSession`, `resetForNewUser` |
| `CollectionLoading` | none | `loadingMessage` | none |
| `ComparisonView` | none | `currentPair`, `games`, `ratings`, `sessionComparisons`, `comparisonsTotal` | `pick`, `skip`, `refresh` |
| `GameCard` | `gameId: string` | `games[gameId]`, `ratings` | none (read-only display) |

**Strict rule maintained:** No component imports `bggClient`. All API calls flow through store actions. [CITED: CLAUDE.md "UI components never call bggClient directly"]

### Continue-or-Refetch Prompt (D-10)

Render inline in `UsernameEntry`, not as a modal:

```typescript
// In UsernameEntry.tsx — after username submission finds a matching stored session
{showContinuePrompt && (
  <div>
    <p>Found {rankingsCount} ranked games from your last session.</p>
    <button onClick={continueSession}>Continue ranking</button>
    <button onClick={resetForNewUser}>Re-fetch collection</button>
  </div>
)}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 |
| Config file | `vitest.config.ts` (`environment: 'node'`, `globals: true`) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |
| Test file pattern | `src/**/*.test.ts` |

**Note:** The vitest environment is `node`. Tests that need `localStorage` must use a custom mock storage (see Pitfall 6). Tests that need React rendering must add `environment: 'jsdom'` via docblock: `// @vitest-environment jsdom`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLL-01 | `parseCollectionXml` extracts id, name, yearPublished, thumbnail | unit | `npm test -- src/api/bggClient.test.ts` | Wave 0 |
| COLL-01 | `poll202Loop` retries on 202, succeeds on 200 | unit (fetch mock) | `npm test -- src/api/bggClient.test.ts` | Wave 0 |
| COLL-03 | `mergeCollections` deduplicates by objectid, owned wins | unit | `npm test -- src/api/bggClient.test.ts` | Wave 0 |
| COLL-01 | `parseCollectionXml` with 0 items throws | unit | `npm test -- src/api/bggClient.test.ts` | Wave 0 |
| COLL-01 | `parseCollectionXml` with single item (not array) works | unit | `npm test -- src/api/bggClient.test.ts` | Wave 0 |
| RANK-01 | Store: `fetchCollection` calls `initializeRankings` on first use | unit (store + mock client) | `npm test -- src/store/store.test.ts` | Wave 0 |
| RANK-02 | `selectRandomPair` returns 2 distinct IDs | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| RANK-03 | `pick(winner, loser)` updates `ratings` via `applyUpset` | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| RANK-04 | `skip()` appends pair to skipQueue; next `pick()` drains queue first | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| RANK-05 | `pick()` increments both `sessionComparisons` and `comparisonsTotal` | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| REFRESH-01 | `refresh()` calls `redistribute`, ratings change, order preserved | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| PERSIST-01 | After `pick()`, ratings appear in mocked localStorage | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| PERSIST-02 | `fetchCollection` shows prompt when `rankingsUsername === username` | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| PERSIST-02 | `fetchCollection` discards stored rankings when username differs | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| COLL-01 | 990-game collection: `validateTierCapacity` passes | unit | `npm test -- src/store/store.test.ts` | Wave 0 |
| COLL-01 | 991-game collection: shows error, does NOT persist | unit | `npm test -- src/store/store.test.ts` | Wave 0 |

### Wave 0 Gaps

- [ ] `src/api/bggClient.test.ts` — XML parse tests, 202 poll tests, merge/dedup tests
- [ ] `src/store/store.test.ts` — all store action tests; requires mock storage + mock bggClient

### Mock Strategy for Store Tests

```typescript
// In store.test.ts — custom in-memory storage to avoid needing jsdom
const mockStorage: Record<string, string> = {}
const testStorage = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v },
  removeItem: (k: string) => { delete mockStorage[k] },
}
// Pass to store's persist storage in test setup
```

---

## TanStack Query vs Plain Fetch Decision

**Decision: Use plain `fetch` with a manual polling loop.** TanStack Query is available but adds complexity for the 202 pattern.

| Factor | Plain fetch | TanStack Query |
|--------|------------|----------------|
| 202 polling | Natural — `while/retry` loop | Possible via `refetchInterval: (q) => shouldStop(q) ? false : 3000` |
| Loading state | Manual: store.view = 'loading' | Built-in: `isLoading`, `isFetching` |
| Error handling | Manual: `try/catch` → `store.errorMessage` | Built-in: `error` field |
| Test complexity | Low: mock `fetch`, test store action | Medium: needs `QueryClientProvider` wrapper |
| Store integration | Direct call from store action | Must call from component (loses "no API from components" rule) or use `fetchQuery` |

**The decisive factor:** The rule "UI components never call `bggClient` directly" means collection fetching must be initiated from a store action (`store.fetchCollection`). TanStack Query's `useQuery` hook is designed to run in components. Using `queryClient.fetchQuery()` from within a store action is possible but is an unusual pattern that loses TanStack Query's DX benefits. Plain `fetch` in a store action is simpler, more testable, and more aligned with the project's architecture.

TanStack Query remains available for Phase 3 and Phase 4 if there are appropriate use cases.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `fast-xml-parser` | BGG XML parsing | Yes | 5.8.0 | — |
| `zustand` (+ persist) | State management | Yes | 5.0.13 | — |
| `@tanstack/react-query` | Optional collection fetch | Yes | 5.100.13 | Not needed (plain fetch used) |
| Vite dev proxy | BGG CORS bypass in dev | Yes | vite.config.ts configured | — |
| Vitest | Tests | Yes | 4.1.7 | — |
| `localStorage` in tests | Persist middleware tests | No (node env) | — | Custom mock storage object |

[VERIFIED: package.json in repo — all packages installed]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| DOMParser for XML | fast-xml-parser (already decided) | Zero-dependency alternative; fxp is already installed |
| Per-component localStorage reads | Zustand persist middleware | Single source of truth, auto-rehydration |
| Direct BGG fetch from component | Store action → bggClient | Testable, no CORS issues, aligned with architecture rule |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `isArray` option in fast-xml-parser forces single items into arrays | Pattern 2 (XML parsing) | Without it, single-game collections crash at `.map()` — verify against fxp 5.8.0 docs or test fixture |
| A2 | Single persist key is acceptable vs ARCHITECTURE.md's two-key schema | Persistence Schema | If project requires strict key separation, split into two stores — low risk, easy to split |
| A3 | BGG `<stats>` → `<rating value="N/A">` for unrated games (not missing element) | BGG XML Schema | If missing entirely, `ratingEl?.['@_value']` returns undefined — add fallback regardless |
| A4 | BGG API2 collection includes `thumbnail` as a text-node URL (not a value attribute) | BGG XML Schema | If it's an attribute, access pattern changes to `item.thumbnail['@_value']` — verify in smoke test |
| A5 | Parallel `Promise.all` for two collection queries is safe (no BGG rate limiting on reads) | Two-Query Strategy | BGG may throttle parallel collection requests — fallback: sequential with 500ms delay between |

---

## Open Questions

1. **BGG rate limiting on parallel collection reads**
   - What we know: PITFALLS.md M3 documents throttling for *write* operations (200–500ms). No documented limits for reads.
   - What's unclear: Does BGG throttle simultaneous collection GET requests from the same client?
   - Recommendation: Use `Promise.all` initially. If 429s or missing responses appear in testing, switch to sequential requests with a short delay (500ms).

2. **BGG `<thumbnail>` URL format — HTTPS vs protocol-relative**
   - What we know: Sample data shows `//cf.geekdo-images.com/...` (protocol-relative, no scheme).
   - What's unclear: Does the production BGG API return `https://...` or `//...`?
   - Recommendation: Store raw as returned. In Phase 4 (DISP-01), apply `https:` prefix if needed when rendering `<img src>`.

3. **`vitest.config.ts` single environment vs per-file override**
   - What we know: Engine tests use `environment: 'node'`. Store tests may need `localStorage` mock.
   - What's unclear: Whether `// @vitest-environment jsdom` docblock works with the current config.
   - Recommendation: Keep global `environment: 'node'`. Use custom in-memory storage mock for store tests instead of `jsdom`. Avoids config change that could break existing tests.

---

## Security Domain

The security domain is minimal for Phase 2 — no authentication, no credential handling.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 3 |
| V3 Session Management | No | Phase 3 |
| V4 Access Control | No | N/A (single-user local app) |
| V5 Input Validation | Yes | Username input: trim, non-empty; no further validation needed (BGG will reject invalid usernames with an API error) |
| V6 Cryptography | No | N/A |

**Username input safety:** The BGG username is passed as a URL query parameter. Percent-encode it with `encodeURIComponent()` before constructing the URL. [ASSUMED — standard web security practice]

---

## Sources

### Primary (HIGH confidence)
- `src/engine/rankingEngine.ts` — Phase 1 engine API: `initializeRankings`, `applyUpset`, `redistribute`, `validateTierCapacity`, `TierCapacityError`, `TIER_WEIGHTS`, `MAX_GAMES` — all verified by reading source
- `package.json` — all dependency versions verified by reading source
- `vitest.config.ts` — test environment configuration verified by reading source
- `CLAUDE.md` — all constraint rules (partialize, integer storage, 202 polling params, localStorage key format, no credentials in storage)
- `.planning/research/ARCHITECTURE.md` — Zustand slice interfaces, component boundaries
- `.planning/research/PITFALLS.md` — C1 (202 loop), C3 (re-fetch overwrites), C4 (tier overflow), C5 (float precision), M1 (HTML 200 error)
- `.planning/phases/02-collection-ranking/02-CONTEXT.md` — all D-0x decisions

### Secondary (MEDIUM confidence)
- lcosmin/boardgamegeek `collection.py` — BGG API2 XML field names: `item.attrib["objectid"]`, `xml_subelement_text(item, "thumbnail")`, `xml_subelement_attr(item, "yearpublished")`, `xml_subelement_attr(stats, "rating")` — verified via WebFetch
- jemiahlee/bgg `sample_data/collection.xml` — BGG XML v1 structure; API2 `value` attribute differences confirmed via WebSearch cross-reference
- WebSearch: Zustand 5 persist + partialize + slice pattern — confirmed against official Zustand docs URL `zustand.docs.pmnd.rs`
- WebSearch: TanStack Query v5 `refetchInterval` dynamic function — confirmed against `tanstack.com/query/latest/docs/framework/react/guides/polling`

### Tertiary (LOW confidence)
- BGG API2 `value` attribute format (`<name value="..."/>`, `<yearpublished value="..."/>`) — WebSearch cross-reference from multiple community implementations; cannot directly access boardgamegeek.com wiki (403); MEDIUM confidence
- fast-xml-parser `isArray` option behavior for single-element collections — based on npm documentation search; marked [ASSUMED] in assumptions log

---

## Metadata

**Confidence breakdown:**
- BGG XML schema: MEDIUM — confirmed via multiple client library sources; exact API2 attribute names consistent across sources; cannot directly verify from official BGG wiki (403 blocked)
- Zustand store design: HIGH — derived from official Zustand docs + existing ARCHITECTURE.md interfaces + CLAUDE.md constraints
- Engine integration: HIGH — source code read directly; API signatures verified
- fast-xml-parser usage: MEDIUM — npm doc search; one ASSUMED claim about `isArray`
- Test strategy: HIGH — vitest.config.ts read directly; test patterns derived from existing test file structure

**Research date:** 2026-05-23
**Valid until:** 2026-07-23 (60 days — BGG API unlikely to change; Zustand/Vitest APIs stable)
