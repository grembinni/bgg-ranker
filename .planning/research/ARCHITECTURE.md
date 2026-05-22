# Architecture Patterns

**Domain:** Browser SPA — BoardGameGeek ranking tool
**Researched:** 2026-05-22
**Confidence:** MEDIUM overall (BGG API: MEDIUM; browser platform APIs: HIGH)

---

## Recommended Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Browser SPA                          │
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  UI Layer   │──▶│ Store Layer  │──▶│ Engine Layer │  │
│  │  (React)    │◀──│  (Zustand)   │   │  (plain TS)  │  │
│  └─────────────┘   └──────┬───────┘   └──────────────┘  │
│                           │                              │
│                    ┌──────▼───────┐                      │
│                    │ Persistence  │                      │
│                    │ (localStorage│                      │
│                    │  middleware) │                      │
│                    └──────────────┘                      │
│                           │                              │
│              ┌────────────▼────────────┐                 │
│              │    BGG API Client       │                 │
│              │  (fetch + DOMParser)    │                 │
│              └────────────┬────────────┘                 │
└───────────────────────────┼──────────────────────────────┘
                            │  HTTP (proxied)
              ┌─────────────▼─────────────┐
              │       Proxy Layer         │
              │  (Vite dev / Cloudflare   │
              │        Worker)            │
              └─────────────┬─────────────┘
                            │  HTTPS
              ┌─────────────▼─────────────┐
              │    BGG XML API2           │
              │  boardgamegeek.com        │
              └───────────────────────────┘
```

---

## 1. CORS: The First Dependency

BGG's API endpoints do not return `Access-Control-Allow-Origin` headers. Direct `fetch()` from a browser SPA is rejected by CORS policy. This is the **single hard blocker for Phase 1** — nothing else works until CORS is solved.

### Two-tier proxy strategy

**Development:** Vite's built-in `server.proxy` rewrites `/bggapi/*` → `https://boardgamegeek.com/*`. Zero additional infrastructure.

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/bggapi': {
        target: 'https://boardgamegeek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bggapi/, ''),
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})
```

**Production:** Cloudflare Worker (free tier) that forwards requests to BGG, sets `Access-Control-Allow-Origin`, and relays `Set-Cookie` headers for auth.

**Environment variable:**
```
VITE_BGG_API_BASE=/bggapi                                  # dev
VITE_BGG_API_BASE=https://bgg-proxy.example.workers.dev   # prod
```

### Cookie handling for auth

BGG's login returns a `SessionID` cookie. The proxy must forward `Cookie` upstream and `Set-Cookie` downstream. In production, the SPA and Worker share the same Cloudflare Pages domain — `credentials: 'include'` on `fetch()` works.

---

## 2. BGG XML API2 — Relevant Endpoints

| Endpoint | Method | Auth Required | Purpose |
|---|---|---|---|
| `/xmlapi2/collection?username=X&own=1&subtype=boardgame` | GET | No | Fetch owned games |
| `/login/api/v1` | POST JSON | — | Obtain session cookie |
| `/api/geekrating` | POST form | Yes (session cookie) | Write star rating |

**Critical:** The collection endpoint returns HTTP 202 on first call (queued). The client must poll with a retry loop until 200. See Pitfalls.

---

## 3. XML Parsing

**Use the browser's built-in `DOMParser`** — no library dependency:

```typescript
const parser = new DOMParser();
const doc = parser.parseFromString(xmlText, 'application/xml');
// Check for parse error: doc.querySelector('parsererror')
const items = doc.querySelectorAll('item');
```

This is zero-dependency, universally supported, and fast enough for any realistic collection size.

---

## 4. State Management — Zustand Slices

```typescript
// Session slice — NEVER persisted (credentials in memory only)
interface SessionState {
  username: string | null;
  sessionAcquired: boolean;
}

// Collection slice — persisted
interface CollectionState {
  games: Record<string, Game>;  // keyed by BGG objectid
  lastFetched: number | null;
}

// Rankings slice — persisted
interface RankingsState {
  ratings: Record<string, number>;  // gameId -> decimal rating e.g. 7.43
  comparisonsTotal: number;
  version: number;
}

// Comparison slice — NOT persisted (session only)
interface ComparisonState {
  currentPair: [string, string] | null;
  sessionComparisons: number;
}

// Sync slice — NOT persisted
interface SyncState {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncedAt: number | null;
  lastSyncedRatings: Record<string, number> | null;  // for partial-sync recovery
}
```

The `persist` middleware `partialize` function must include **only** `CollectionState` and `RankingsState`. Session credentials and in-flight state must never be serialized.

---

## 5. Ranking Engine — Plain TypeScript Module

The bell-curve allocation and decimal spacing math is pure computation. It belongs in `src/engine/rankingEngine.ts` as pure functions — no I/O, no DOM, no side effects.

**Do NOT use a Web Worker.** At 2000 games, redistribution is O(n) and runs in ~10ms. Worker complexity is not worth it unless profiling proves otherwise.

```typescript
function normalizeTierWeights(weights: number[]): number[]
function computeTierAllocations(gameCount: number, weights: number[]): number[]
function assignRatings(orderedGameIds: string[], tierAllocations: number[]): Record<string, number>
function applyUpset(winnerId: string, loserId: string, ratings: Record<string, number>): Record<string, number>
function redistribute(ratings: Record<string, number>, tierWeights: number[]): Record<string, number>
```

**Integer-internal representation:** Store all ratings as integers (`801` = 8.01). Divide by 100 only at output (display / BGG sync). This eliminates IEEE 754 floating-point precision errors.

---

## 6. localStorage Schema

Key naming: `bgg-ranker:v1:<slice>` (versioned to prevent stale schema corruption)

```typescript
// "bgg-ranker:v1:collection"
interface PersistedCollection {
  version: 1;
  storedAt: number;
  games: Record<string, { id: string; name: string; thumbnail: string; }>;
}

// "bgg-ranker:v1:rankings"
interface PersistedRankings {
  version: 1;
  storedAt: number;
  username: string;           // guard: discard if different user logs in
  ratings: Record<string, number>;  // integer-internal (e.g. 801 = 8.01)
  comparisonsTotal: number;
}
```

**Username guard:** On load, if `PersistedRankings.username` differs from the logged-in user, discard stored rankings. Do not merge across users.

Max size estimate: 2000 games × ~100 bytes = ~200KB — well within the 5MB localStorage limit.

---

## 7. BGG Authentication Flow

```
User enters username + password
  → POST /bggapi/login/api/v1  { credentials: { username, password } }
  ← HTTP 200 + Set-Cookie: SessionID=... (proxied, cookie forwarded)
  → SessionState.sessionAcquired = true
  → Credentials cleared from all variables (never persisted)

Subsequent write calls:
  → fetch('/bggapi/api/geekrating', { credentials: 'include' })
  → Cookie forwarded automatically by browser → proxy → BGG

Session expiry:
  → 401 response on write call → prompt re-auth
  → In-memory credentials are gone → user must re-enter password
```

---

## Component Boundaries

| Component | Location | Responsibility |
|---|---|---|
| Vite proxy config | `vite.config.ts` | Dev-time CORS bypass |
| `bggClient.ts` | `src/api/bggClient.ts` | All HTTP to BGG, XML parsing, 202 polling loop |
| `rankingEngine.ts` | `src/engine/rankingEngine.ts` | Pure ranking math — no I/O |
| `store.ts` | `src/store/store.ts` | App state, orchestrates API + engine calls |
| UI components | `src/components/` | Render state, dispatch actions — no direct API calls |
| Cloudflare Worker | `proxy/worker.ts` | Production CORS proxy |

**Strict rule:** UI components never call `bggClient` directly. All API interaction is initiated by the store.

---

## Suggested Build Order

```
Step 1: Vite proxy config
  └─ Hard prerequisite for ALL BGG API work. Phase 1, Day 1.

Step 2: rankingEngine.ts (pure module)
  └─ Zero dependencies. Build and unit-test in full isolation.

Step 3: bggClient.ts — collection fetch + XML parsing + 202 polling loop
  └─ Requires Step 1. Public endpoint — no auth needed for read testing.

Step 4: store.ts + persistence middleware
  └─ Requires Steps 2 + 3. Establishes localStorage schema.

Step 5: Auth (login UI + bggClient.login() + cookie handling)
  └─ Requires Step 1. Can be developed alongside Step 6.

Step 6: Comparison UI + ranking display
  └─ Requires Step 4.

Step 7: BGG sync (write ratings)
  └─ Requires Steps 4 + 5.

Step 8: Production Cloudflare Worker
  └─ Needed at deployment time only. Mirrors Vite proxy config.
```

**Parallelizable:** Steps 2 and 3 can be developed simultaneously. Steps 5 and 6 share no code dependencies.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Instead |
|---|---|---|
| Direct BGG fetch from UI components | CORS block; tight coupling; untestable | All API calls go through `bggClient`, invoked only by the store |
| Storing credentials in localStorage | Violates AUTH-03; XSS-readable | Credentials live only in SessionState (in-memory) |
| Running full redistribute after every comparison | O(n) for a single pick is wasteful | `applyUpset()` is O(k) between affected positions; `redistribute()` only on explicit Refresh |
| Public CORS proxy in production | Leaks BGG session cookie through third party | Own proxy (Vite dev + scoped Cloudflare Worker) |

---

## Performance at Scale

| Concern | 50 games | 500 games | 2000 games |
|---|---|---|---|
| localStorage size | ~5KB | ~50KB | ~200KB — within 5MB |
| Redistribution time | <1ms | ~3ms | ~10ms — no Worker needed |
| Collection XML parse | <1ms | ~5ms | ~20ms — DOMParser fast |
| BGG sync | instant | ~50s at 100ms gap | ~200s — needs progress UI |
