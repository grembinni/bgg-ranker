# Phase 2: Collection & Ranking - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 10 (8 new, 2 modified)
**Analogs found:** 6 / 10 (4 files are genuinely novel; patterns from RESEARCH.md apply to those)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/api/bggClient.ts` | service | request-response + polling | `proxy/functions/src/index.ts` | partial (same BGG domain, different transport) |
| `src/store/store.ts` | store | CRUD + event-driven | `src/engine/rankingEngine.ts` | partial (same pure-TS module shape, different concern) |
| `src/components/UsernameEntry.tsx` | component | request-response | `src/App.tsx` | partial (same JSX/React conventions) |
| `src/components/CollectionLoading.tsx` | component | event-driven | `src/App.tsx` | partial (same JSX/React conventions) |
| `src/components/ComparisonView.tsx` | component | event-driven | `src/App.tsx` | partial (same JSX/React conventions) |
| `src/components/GameCard.tsx` | component | transform | `src/engine/rankingEngine.ts` | partial (pure computation pattern) |
| `src/components/ErrorDisplay.tsx` | component | request-response | `src/App.tsx` | partial (same JSX/React conventions) |
| `src/App.tsx` | component | event-driven | `src/App.tsx` (self, extend) | exact (same file, extend pattern) |
| `src/api/bggClient.test.ts` | test | — | `src/engine/rankingEngine.test.ts` | exact (same test framework, same conventions) |
| `src/store/store.test.ts` | test | — | `src/engine/rankingEngine.test.ts` | role-match (same framework; needs mock storage) |

---

## Pattern Assignments

### `src/api/bggClient.ts` (service, request-response + polling)

**Primary analog:** `proxy/functions/src/index.ts` (BGG forwarding, HTTP error handling)
**Secondary analog:** RESEARCH.md Pattern 1 (202 polling loop) and Pattern 2 (XML parsing) — no existing client analog in codebase

**Imports pattern** — established by `src/api/bggClient.ts` stub (line 2) and RESEARCH.md:
```typescript
import { XMLParser } from 'fast-xml-parser'

export const BGG_API_BASE = import.meta.env.VITE_BGG_API_BASE as string
```

**Key conventions from `proxy/functions/src/index.ts`:**

HTTP error handling pattern (lines 45-47):
```typescript
upstream.on('error', (err: Error) => {
  res.status(502).json({ error: err.message })
})
```
— Same pattern in bggClient: catch `Error`, surface `.message` as the error string.

BGG path construction pattern (lines 13-14):
```typescript
hostname: 'boardgamegeek.com',
path: targetPath,
```
— In bggClient, equivalent is `${BGG_API_BASE}/xmlapi2/collection?username=${encodeURIComponent(username)}&...`

Cookie/session header forwarding pattern (lines 19-22):
```typescript
...(req.headers['x-bgg-session']
  ? { Cookie: `sessionid=${req.headers['x-bgg-session']}` }
  : {}),
```
— Phase 2 bggClient does NOT forward session (read-only, no auth). This pattern is deferred to Phase 3. Do NOT replicate it in Phase 2.

**202 polling loop pattern** — from RESEARCH.md Pattern 1 (no codebase analog exists):
```typescript
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
    if (text.trim().toLowerCase().startsWith('<html')) {
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

**XML parser pattern** — from RESEARCH.md Pattern 2 (no codebase analog exists):
```typescript
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (_name, jPath) => jPath === 'items.item',
})
```

**Deduplication pattern** — from RESEARCH.md §Two-Query Strategy:
```typescript
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

**Error handling pattern** — consistent with `proxy/functions/src/index.ts` (lines 45-47):
- All errors thrown as `new Error(message)` with descriptive string
- No custom error classes in bggClient (only rankingEngine uses TierCapacityError)
- Store catches and converts to `errorMessage` string for UI

**0-game guard** (CLAUDE.md constraint, PITFALL C1):
```typescript
// After parsing — before returning
if (games.length === 0) {
  throw new Error('BGG returned 0 games — not writing to localStorage')
}
```

**Module export shape** — matches `src/engine/rankingEngine.ts` (named exports, no default):
```typescript
// Named exports only (no default export) — matches rankingEngine.ts convention
export interface RawGame { ... }
export async function fetchCollection(username: string): Promise<RawGame[]> { ... }
// Internal helpers are NOT exported: poll202Loop, delay, parseCollectionXml, mergeCollections
```

---

### `src/store/store.ts` (store, CRUD + event-driven)

**Primary analog:** `src/engine/rankingEngine.ts` — establishes pure-TS module shape, named exports, JSDoc comments, no default export
**Secondary analog:** RESEARCH.md Patterns 3–7 (Zustand persist + partialize; no Zustand store exists yet)

**Module-level JSDoc comment pattern** — from `src/engine/rankingEngine.ts` (lines 1-13):
```typescript
/**
 * store.ts — Zustand App Store
 *
 * All API calls flow through store actions — UI components never import bggClient directly.
 * SessionState and ComparisonState are NOT persisted (AUTH-03).
 * Ratings stored as integers: 801 = 8.01 (divide by 100 only at display/sync time).
 * localStorage key: bgg-ranker:v1:collection-and-rankings
 */
```

**Import pattern** — established by rankingEngine convention (clean named imports):
```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { fetchCollection as bggFetchCollection } from '../api/bggClient'
import {
  initializeRankings,
  applyUpset,
  redistribute,
  validateTierCapacity,
  TierCapacityError,
} from '../engine/rankingEngine'
```

**TypeScript interfaces** — from RESEARCH.md Pattern 3 (must disambiguate username fields per Pitfall 5):
```typescript
export interface Game {
  id: string
  name: string
  yearPublished: number
  thumbnail: string
}

interface SessionState {
  sessionUsername: string | null  // ephemeral — NEVER in partialize (AUTH-03, D-08)
}

interface CollectionState {
  games: Record<string, Game>
  lastFetched: number | null
}

interface RankingsState {
  ratings: Record<string, number>  // integer-internal: 801 = 8.01
  comparisonsTotal: number
  rankingsUsername: string | null  // PERSIST-02 guard (D-09) — persisted
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
```

**persist + partialize pattern** — from RESEARCH.md Pattern 3 (CLAUDE.md constraint: partialize must explicitly exclude SessionState):
```typescript
export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({ /* state + actions */ }),
    {
      name: 'bgg-ranker:v1:collection-and-rankings',
      storage: createJSONStorage(() => localStorage),
      // CRITICAL: partialize must exclude SessionState and ComparisonState (AUTH-03)
      partialize: (state) => ({
        games: state.games,
        lastFetched: state.lastFetched,
        ratings: state.ratings,
        comparisonsTotal: state.comparisonsTotal,
        rankingsUsername: state.rankingsUsername,
        version: state.version,
      }),
    }
  )
)
```

**Error handling pattern** — from `src/engine/rankingEngine.ts` TierCapacityError pattern (lines 19-27):
```typescript
// In fetchCollection action — catch TierCapacityError specifically, then generic Error
try {
  validateTierCapacity(games.length)
} catch (err) {
  if (err instanceof TierCapacityError) {
    set({ view: 'error', errorMessage: err.message })
    return
  }
  throw err
}
```

**Integer-only invariant** — from rankingEngine.ts file-level comment (lines 7-8):
- `ratings` values are always integers in store state and localStorage
- Division by 100 happens only in component render (display) and Phase 3 BGG sync

---

### `src/components/UsernameEntry.tsx` (component, request-response)

**Primary analog:** `src/App.tsx` — establishes JSX function component conventions, no imports from API layer

**Component pattern** — from `src/App.tsx` (lines 1-5):
```typescript
// Function component — no default props, no class components
function App() {
  return <h1>BGG Ranker</h1>
}
export default App
```

Extend to:
```typescript
import { useStore } from '../store/store'

export default function UsernameEntry() {
  const fetchCollection = useStore(s => s.fetchCollection)
  const rankingsUsername = useStore(s => s.rankingsUsername)
  const ratings = useStore(s => s.ratings)
  // local state for form input only — never in store
  const [input, setInput] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  ...
}
```

**No direct API call rule** (CLAUDE.md, RESEARCH.md §Anti-Patterns):
- Component calls `fetchCollection` store action, never `import { fetchCollection } from '../api/bggClient'`
- All store reads via `useStore(selector)` — one selector per value (not `useStore()` spread)

**Continue-or-refetch prompt pattern** — from RESEARCH.md §Continue-or-Refetch Prompt:
```typescript
// Inline in component body — NOT a modal
{showPrompt && (
  <div>
    <p>Found {Object.keys(ratings).length} ranked games from your last session.</p>
    <button onClick={() => useStore.getState().continueSession()}>Continue ranking</button>
    <button onClick={() => useStore.getState().resetForNewUser()}>Re-fetch collection</button>
  </div>
)}
```

**Tailwind v4 classes** — CSS-first, no config file (from `src/index.css` line 1: `@import 'tailwindcss'`):
- Use utility classes directly: `className="flex flex-col gap-4 p-8 max-w-md mx-auto"`
- No custom theme config, no `@apply`, no `tailwind.config.js`
- D-04: functional/clean only, no animations, no design polish

---

### `src/components/CollectionLoading.tsx` (component, event-driven)

**Primary analog:** `src/App.tsx` — same component shape conventions

**Pattern:**
```typescript
import { useStore } from '../store/store'

export default function CollectionLoading() {
  const loadingMessage = useStore(s => s.loadingMessage)
  return (
    <div>
      <p>{loadingMessage ?? 'Loading collection...'}</p>
    </div>
  )
}
```

- Read-only component: no store actions, only reads `loadingMessage`
- No spinner animation (D-04 — no animation in Phase 2)
- `loadingMessage` is set by store's `fetchCollection` action during each polling attempt

---

### `src/components/ComparisonView.tsx` (component, event-driven)

**Primary analog:** `src/App.tsx` — same component conventions; store integration pattern

**Store reads pattern** — one selector per value:
```typescript
const currentPair = useStore(s => s.currentPair)
const games = useStore(s => s.games)
const ratings = useStore(s => s.ratings)
const sessionComparisons = useStore(s => s.sessionComparisons)
const comparisonsTotal = useStore(s => s.comparisonsTotal)
const sessionUsername = useStore(s => s.sessionUsername)
const pick = useStore(s => s.pick)
const skip = useStore(s => s.skip)
const refresh = useStore(s => s.refresh)
```

**Layout pattern** — D-03 (header with counter, two cards, secondary buttons below):
```typescript
return (
  <div>
    <header>
      <span>{sessionUsername}</span>
      <span>{sessionComparisons} / {comparisonsTotal} comparisons</span>
    </header>
    <div>
      <GameCard gameId={currentPair[0]} onPick={() => pick(currentPair[0], currentPair[1])} />
      <GameCard gameId={currentPair[1]} onPick={() => pick(currentPair[1], currentPair[0])} />
    </div>
    <button onClick={skip}>Skip</button>
    <button onClick={refresh}>Refresh</button>
  </div>
)
```

---

### `src/components/GameCard.tsx` (component, transform)

**Primary analog:** `src/engine/rankingEngine.ts` — establishes the pure computation pattern used for rank position

**Rank position computation** — from RESEARCH.md Pattern 8 (pure function, computed at render):
```typescript
function getRankPosition(gameId: string, ratings: Record<string, number>): number {
  const sorted = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  return sorted.findIndex(([id]) => id === gameId) + 1  // 1-indexed
}
```

**Props pattern** — GameCard receives `gameId` only; reads game data from store directly (avoids prop-drilling full Game object):
```typescript
interface GameCardProps {
  gameId: string
  onPick: () => void
}

export default function GameCard({ gameId, onPick }: GameCardProps) {
  const game = useStore(s => s.games[gameId])
  const ratings = useStore(s => s.ratings)
  const rank = getRankPosition(gameId, ratings)
  const total = Object.keys(ratings).length
  // D-05: shows name + yearPublished
  // D-06: shows rank position (#47 of 200)
  // D-07: thumbnail stored but NOT displayed in Phase 2
  return (
    <button onClick={onPick}>
      <div>{game.name} ({game.yearPublished})</div>
      <div>#{rank} of {total}</div>
    </button>
  )
}
```

---

### `src/components/ErrorDisplay.tsx` (component, request-response)

**Primary analog:** `src/App.tsx` — same component shape

**Pattern:**
```typescript
import { useStore } from '../store/store'

export default function ErrorDisplay() {
  const errorMessage = useStore(s => s.errorMessage)
  const resetForNewUser = useStore(s => s.resetForNewUser)
  return (
    <div>
      <p>{errorMessage}</p>
      <button onClick={resetForNewUser}>Try again</button>
    </div>
  )
}
```

---

### `src/App.tsx` (component, event-driven) — MODIFY EXISTING

**Analog:** Self (current file, lines 1-5) + RESEARCH.md §App.tsx View Router

**Current content** (`src/App.tsx` lines 1-5):
```typescript
function App() {
  return <h1>BGG Ranker</h1>
}
export default App
```

**Replace with** view-switch pattern from RESEARCH.md:
```typescript
import { useStore } from './store/store'
import { UsernameEntry } from './components/UsernameEntry'
import { CollectionLoading } from './components/CollectionLoading'
import { ComparisonView } from './components/ComparisonView'
import { ErrorDisplay } from './components/ErrorDisplay'

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
export default App
```

**Import path convention** — from `src/main.tsx` (lines 4-5):
```typescript
import './index.css'
import App from './App.tsx'
```
- `.tsx` extension in imports (Vite bundler mode, `allowImportingTsExtensions: true` in tsconfig.app.json)
- Relative path from file location, no path aliases

---

### `src/api/bggClient.test.ts` (test) — NEW

**Exact analog:** `src/engine/rankingEngine.test.ts`

**File header pattern** (lines 1-7):
```typescript
/**
 * bggClient.test.ts — Unit tests for the BGG API client
 *
 * Covers requirements: COLL-01, COLL-03
 * Each test name includes the relevant requirement ID for grep traceability.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
```

**Import pattern** (lines 7-18 of rankingEngine.test.ts):
```typescript
import {
  parseCollectionXml,    // internal — must be exported for testing
  mergeCollections,      // internal — must be exported for testing
  // fetchCollection is integration-level; test via mock fetch
} from './bggClient'
```

Note: `parseCollectionXml` and `mergeCollections` must be exported from `bggClient.ts` (even if not part of the public API) to enable unit testing without mocking the entire HTTP layer.

**describe/it structure** (lines 31-62 of rankingEngine.test.ts):
```typescript
describe('parseCollectionXml (COLL-01)', () => {
  it('extracts id, name, yearPublished, thumbnail from valid XML (COLL-01)', () => { ... })
  it('handles single item without crashing (COLL-01)', () => { ... })
  it('throws when game count is 0 (COLL-01)', () => { ... })
  it('reads name from @_value attribute, not text node (COLL-01)', () => { ... })
})

describe('mergeCollections (COLL-03)', () => {
  it('owned entry wins when same objectid in both results (COLL-03)', () => { ... })
  it('non-duplicate rated-unowned games are included (COLL-03)', () => { ... })
  it('logs debug message on duplicate (COLL-03)', () => { ... })
})

describe('poll202Loop (COLL-01)', () => {
  // Requires vi.stubGlobal('fetch', ...) to mock fetch
  it('retries on 202, succeeds on 200 (COLL-01)', async () => { ... })
  it('throws after MAX_RETRIES consecutive 202s (COLL-01)', async () => { ... })
  it('throws on non-200/202 status (COLL-01)', async () => { ... })
  it('throws when response body starts with <html (COLL-01)', async () => { ... })
})
```

**fetch mock pattern** — vitest `vi.stubGlobal` (no existing codebase example; from vitest docs):
```typescript
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})
```

**Helper pattern** (lines 23-25 of rankingEngine.test.ts):
```typescript
// Helper: minimal BGG collection XML for a single game
function makeCollectionXml(items: Array<{ id: string; name: string; year: number }>): string {
  const itemsXml = items.map(i =>
    `<item objectid="${i.id}" objecttype="thing" subtype="boardgame" collid="123">
      <name sortindex="1" value="${i.name}"/>
      <yearpublished value="${i.year}"/>
      <thumbnail>//cf.geekdo-images.com/pic_t.jpg</thumbnail>
      <stats><rating value="N/A"/></stats>
      <status own="1"/>
    </item>`
  ).join('\n')
  return `<?xml version="1.0" encoding="utf-8"?>\n<items totalitems="${items.length}">\n${itemsXml}\n</items>`
}
```

---

### `src/store/store.test.ts` (test) — NEW

**Exact analog:** `src/engine/rankingEngine.test.ts` (structure), with key divergence: must use mock storage (RESEARCH.md Pitfall 6)

**File header pattern** (matches rankingEngine.test.ts lines 1-7):
```typescript
/**
 * store.test.ts — Unit tests for the Zustand app store
 *
 * Covers requirements: RANK-01 through RANK-05, REFRESH-01, PERSIST-01, PERSIST-02
 * Each test name includes the relevant requirement ID for grep traceability.
 *
 * NOTE: vitest environment is 'node'. localStorage is not available.
 * All persist tests use a custom in-memory storage mock (see mockStorage below).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

**Mock storage pattern** — from RESEARCH.md §Mock Strategy (no codebase analog):
```typescript
// Custom in-memory storage to avoid needing jsdom (Pitfall 6)
function createMockStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  }
}
```

**Store factory pattern** — store must accept an injectable storage for tests (enables mock storage):
```typescript
// In store.ts — export a factory for testing
export function createAppStore(storage = createJSONStorage(() => localStorage)) {
  return create<AppStore>()(persist((set, get) => ({ ... }), { name: '...', storage }))
}
// Default singleton for app use
export const useStore = createAppStore()
```

**bggClient mock pattern** — vi.mock at module level:
```typescript
vi.mock('../api/bggClient', () => ({
  fetchCollection: vi.fn(),
}))
import { fetchCollection } from '../api/bggClient'
```

**describe/it structure** (matches rankingEngine.test.ts pattern):
```typescript
describe('fetchCollection action (RANK-01, COLL-01)', () => {
  it('calls initializeRankings on first load for this user (RANK-01)', async () => { ... })
  it('shows continue-or-refetch prompt when rankingsUsername matches (PERSIST-02)', async () => { ... })
  it('discards stored rankings when username differs (PERSIST-02)', async () => { ... })
  it('sets view to error and does not persist when >990 games (COLL-01)', async () => { ... })
})

describe('pick action (RANK-02, RANK-03, RANK-05)', () => {
  it('selectRandomPair returns 2 distinct IDs (RANK-02)', () => { ... })
  it('updates ratings via applyUpset (RANK-03)', () => { ... })
  it('increments sessionComparisons and comparisonsTotal (RANK-05)', () => { ... })
})

describe('skip action (RANK-04)', () => {
  it('appends pair to skipQueue (RANK-04)', () => { ... })
  it('next pick drains queue before random selection (RANK-04)', () => { ... })
})

describe('refresh action (REFRESH-01)', () => {
  it('calls redistribute, ratings change, relative order preserved (REFRESH-01)', () => { ... })
})

describe('persist (PERSIST-01)', () => {
  it('ratings appear in mock localStorage after pick() (PERSIST-01)', () => { ... })
})
```

---

## Shared Patterns

### TypeScript Strict Mode
**Source:** `tsconfig.app.json` (lines 24-28)
**Apply to:** All new `.ts` and `.tsx` files
```json
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true
```
- No `any` types — use `unknown` and narrow
- All function parameters must be used
- All imports must be used

### Module Export Convention
**Source:** `src/engine/rankingEngine.ts` (all named exports, no default export)
**Apply to:** `src/api/bggClient.ts`, `src/store/store.ts`

```typescript
// Named exports for non-UI modules
export interface RawGame { ... }
export async function fetchCollection(...) { ... }
// NOT: export default function fetchCollection(...)
```

React components use default exports (matches `src/App.tsx` line 4: `export default App`):
```typescript
// Default export for components
export default function UsernameEntry() { ... }
```

### JSDoc Comment Block
**Source:** `src/engine/rankingEngine.ts` (lines 1-13, and per-function JSDoc lines 49-57, 70-77, etc.)
**Apply to:** `src/api/bggClient.ts`, `src/store/store.ts`

```typescript
/**
 * functionName — brief description
 *
 * @param paramName - Description
 * @returns Description
 * @throws ErrorType if condition
 */
```

### Tailwind v4 CSS-First
**Source:** `src/index.css` (line 1: `@import 'tailwindcss'`)
**Apply to:** All `.tsx` component files
- Use utility classes directly in `className` props
- No `tailwind.config.js`, no `@apply`, no custom theme
- D-04: clean/functional only — no animations (`animate-*`), no transitions, no shadows/gradients

### Integer-Only Ratings Invariant
**Source:** `src/engine/rankingEngine.ts` (lines 7-8), CLAUDE.md
**Apply to:** `src/store/store.ts`, `src/api/bggClient.test.ts`, `src/store/store.test.ts`
- `ratings` values are integers throughout: store state, localStorage, test fixtures
- Divide by 100 only in display code (Phase 2 does not display decimal values — this division is deferred)
- Test fixtures use integers: `{ 'g1': 900, 'g2': 850 }` not `{ 'g1': 9.0, 'g2': 8.5 }`

### Test Naming Convention
**Source:** `src/engine/rankingEngine.test.ts` (lines 32, 36, 40, etc.)
**Apply to:** `src/api/bggClient.test.ts`, `src/store/store.test.ts`
```typescript
// Pattern: 'description (REQ-ID)'
it('does not throw for exactly 990 games (RANK-10)', () => { ... })
it('extracts id, name, yearPublished, thumbnail from valid XML (COLL-01)', () => { ... })
```

### Vite Import Path Convention
**Source:** `src/main.tsx` (lines 3-5)
**Apply to:** All new `.tsx` files
```typescript
// Use relative paths, include .tsx extension for .tsx files
import App from './App.tsx'
import { UsernameEntry } from './components/UsernameEntry.tsx'
// Use .ts extension for .ts files
import { useStore } from '../store/store'
```

---

## No Analog Found

These files have no close match in the existing codebase. The planner must rely on RESEARCH.md patterns and documented Zustand/fast-xml-parser conventions.

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/api/bggClient.ts` (full implementation) | service | request-response + 202 polling | Only BGG-related code is the proxy forwarder (`proxy/functions/src/index.ts`), which is server-side Node.js HTTP, not a browser `fetch` client with XML parsing |
| `src/store/store.ts` (full implementation) | store | CRUD + event-driven | No Zustand store exists in codebase yet — first store file |
| All `src/components/*.tsx` (except App.tsx) | component | various | No React components beyond the 3-line `App.tsx` stub exist yet |

**For these files, the planner must reference:**
- RESEARCH.md Pattern 3 (Zustand persist + partialize + slice structure)
- RESEARCH.md Pattern 1 (202 polling loop)
- RESEARCH.md Pattern 2 (fast-xml-parser configuration)
- RESEARCH.md Patterns 4–8 (username guard, pair selection, skip queue, pick action, rank position)
- `.planning/research/ARCHITECTURE.md` (slice interfaces and component boundaries)

---

## Metadata

**Analog search scope:** `src/` (all subdirectories), `proxy/functions/src/`
**Files scanned:** 9 source files read in full
**Pattern extraction date:** 2026-05-23

**Key constraint reminders for planner:**
1. `bggClient.ts` is imported only in `store.ts` — never in any component
2. `partialize` must list fields explicitly; SessionState fields (`sessionUsername`) and ComparisonState fields must be absent
3. `rankingsUsername` (persisted, PERSIST-02 guard) vs `sessionUsername` (ephemeral, display) — different field names required to avoid hydration bugs (Pitfall 5)
4. Store tests require a custom mock storage factory — `environment: 'node'` in vitest.config.ts means `localStorage` is unavailable
5. `parseCollectionXml` and `mergeCollections` must be exported from `bggClient.ts` to be unit-testable without mocking `fetch`
