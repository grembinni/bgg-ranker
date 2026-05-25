<!-- generated-by: gsd-doc-writer -->
# Architecture

## System Overview

BGG Ranker is a browser-only single-page application that helps BoardGameGeek users rank their board game collection through head-to-head comparisons. The user presents two games and picks the better one; the ranking engine repositions the winner and adjusts surrounding ratings to maintain a bell-curve distribution across ten tiers (1–10) with decimal precision. Once a session is complete, the user syncs their computed ratings back to BGG via a CORS proxy. All application state is managed by a single Zustand store; there is no server-side application layer.

## Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    React SPA (browser)                   │
│                                                         │
│  ┌──────────────┐    ┌───────────────────────────────┐  │
│  │  UI Layer    │───▶│       Zustand Store           │  │
│  │  (components)│◀───│  (store.ts — AppStore)        │  │
│  └──────────────┘    │                               │  │
│                      │  SessionState  (ephemeral)    │  │
│                      │  CollectionState (persisted)  │  │
│                      │  RankingsState  (persisted)   │  │
│                      │  ComparisonState (ephemeral)  │  │
│                      └──────────┬────────────────────┘  │
│                                 │                        │
│                      ┌──────────▼────────────────────┐  │
│                      │     Ranking Engine             │  │
│                      │  (rankingEngine.ts — pure)     │  │
│                      └───────────────────────────────┘  │
│                                 │                        │
│                      ┌──────────▼────────────────────┐  │
│                      │     BGG Client                 │  │
│                      │  (bggClient.ts — fetch only)   │  │
│                      └──────────┬────────────────────┘  │
└─────────────────────────────────┼────────────────────────┘
                                  │ HTTP (via CORS proxy)
              ┌───────────────────▼───────────────────────┐
              │              CORS Proxy                    │
              │  Dev:  Vite dev proxy  (/bggapi/*)         │
              │  Prod: Firebase Cloud Function (bgg)       │
              └───────────────────┬───────────────────────┘
                                  │ HTTPS
              ┌───────────────────▼───────────────────────┐
              │           BoardGameGeek API                │
              │  /xmlapi2/collection  (XML API2)           │
              │  /login/api/v1        (auth)               │
              │  /api/geekrating      (write, undocumented)│
              └───────────────────────────────────────────┘
```

## Data Flow

A typical session proceeds as follows:

1. **Entry** — The user opens the app. `App.tsx` reads `view` from the store and renders `UsernameEntry`. The user submits their BGG username and password.
2. **Login** — The store calls `bggLogin()` in `bggClient.ts`, which posts credentials to the CORS proxy. The proxy extracts the `sessionid` cookie from BGG's `Set-Cookie` header and returns `{ sessionId }` as JSON. The token is held in `SessionState.sessionId` (never written to localStorage).
3. **Collection fetch** — The store calls `fetchCollection()` in `bggClient.ts`. Two requests are made in parallel: owned games (`own=1`) and rated-unowned games (`rated=1&own=0`). Both may return HTTP 202 on first attempt; `poll202Loop()` retries up to 8 times with a 3-second delay. Results are parsed from XML by `fast-xml-parser` and merged via `mergeCollections()`.
4. **Initialization** — The store calls `initializeRankings()` in `rankingEngine.ts`, which distributes the games across 10 tiers using the bell-curve weights and assigns integer ratings (e.g. `801` = 8.01). All ratings are integer-internal; division by 100 happens only at display or BGG sync time.
5. **Comparison loop** — The store selects a random pair with `selectRandomPair()` and renders `ComparisonView`. When the user picks a winner, `applyUpset()` in the engine repositions the winner into the loser's slot in O(k) time. Changed game IDs are added to `dirtyGameIds`.
6. **Sync** — The user clicks "Sync to BGG". The store iterates `dirtyGameIds`, calling `bggRateGame()` for each with a 1-second throttle between writes. If the session expires mid-sync, `SyncingView` renders an inline re-auth form. On completion the store auto-returns to the comparison view after 2 seconds.
7. **Persistence** — After every state mutation, Zustand's `persist` middleware writes `games`, `ratings`, `dirtyGameIds`, `unplayedIds`, and related fields to `localStorage` under the key `bgg-ranker:v1:collection-and-rankings`. `sessionId` and credentials are explicitly excluded from the persisted slice.

## Key Abstractions

| Abstraction | Location | Description |
|---|---|---|
| `AppStore` | `src/store/store.ts` | Union of all state slices and actions. The single source of truth for the entire app. |
| `createAppStore()` | `src/store/store.ts` | Factory that creates the Zustand store with injectable storage — enables deterministic unit tests by swapping `localStorage` for a mock. |
| `selectRandomPair()` | `src/store/store.ts` | Selects the next game pair; drains `skipQueue` before random selection. Exported for direct unit testing. |
| `RawGame` | `src/api/bggClient.ts` | Typed output of the XML parser — id, name, yearPublished, thumbnail, userRating. Used only at the API boundary; the store converts it to `Game`. |
| `Game` | `src/store/store.ts` | Persisted game data held in `CollectionState.games`. Excludes all ranking data. |
| `poll202Loop()` | `src/api/bggClient.ts` | Retries a BGG endpoint on HTTP 202 up to 8 times with a 3-second delay. |
| `initializeRankings()` | `src/engine/rankingEngine.ts` | Seeds a fresh rating map for a collection. Accepts a `sorted` flag to skip the shuffle when the caller has pre-ordered the game IDs. |
| `applyUpset()` | `src/engine/rankingEngine.ts` | O(k) upset: winner takes loser's rating; games between the two positions shift down one step. |
| `redistribute()` | `src/engine/rankingEngine.ts` | O(n) full recomputation preserving relative order. Called only on explicit user Refresh. |
| `TierCapacityError` | `src/engine/rankingEngine.ts` | Thrown when a collection exceeds 990 games (99 values × 10 tiers). |
| `bggRateGame()` | `src/api/bggClient.ts` | Single adapter for the undocumented BGG `/api/geekrating` endpoint. Converts integer-internal rating to a float string immediately before the write. |

## Directory Structure Rationale

```
bgg-ranker/
├── src/
│   ├── api/          # BGG HTTP client — the only module that calls fetch or parses XML
│   ├── components/   # React UI components — view-only, never import bggClient directly
│   ├── engine/       # Pure ranking logic — no I/O, no DOM, fully unit-tested
│   └── store/        # Zustand store — orchestrates api and engine, owns all app state
├── proxy/
│   └── functions/    # Firebase Cloud Function (production CORS proxy for BGG API)
├── index.html        # Vite SPA entry point
├── vite.config.ts    # Vite config including dev-mode BGG proxy (/bggapi/*)
├── vitest.config.ts  # Vitest configuration
└── firebase.json     # Firebase deployment config pointing at proxy/functions
```

**`src/api/`** — Isolates all network I/O. `bggClient.ts` is the only file that imports `fetch` or `XMLParser`. Components never import from here; all API calls flow through the store.

**`src/components/`** — View layer. Each component reads state from the store via `useStore()` selectors and calls store action functions. No component contains business logic.

**`src/engine/`** — Pure functions with no side effects (except `Math.random` in `initializeRankings`). Separately testable without a DOM or any mocking. Enforces the integer-internal rating invariant.

**`src/store/`** — The application's single source of truth. Composes the API and engine layers, owns the persistence configuration, and exposes a flat `AppStore` interface to the UI.

**`proxy/functions/`** — A Firebase Cloud Function deployed separately from the SPA. In production it receives requests from the SPA, forwards them to `boardgamegeek.com` with appropriate headers, and relays responses. In development, `vite.config.ts` provides an equivalent proxy at `/bggapi/*`.

## CORS Proxy Design

BGG does not set CORS headers on its API responses, so all requests from the browser must pass through a proxy.

**Development** (`vite.config.ts`): The Vite dev server proxies `/bggapi/*` to `https://boardgamegeek.com`. The proxy intercepts `/login/api/v1` responses, extracts the `sessionid` from `Set-Cookie`, and rewrites the response body to `{ sessionId: "..." }` JSON — the same contract the Firebase Function provides in production. Subsequent authenticated requests inject the stored cookie string from memory.

**Production** (`proxy/functions/src/index.ts`): A Firebase Cloud Function deployed to `us-central1`. The SPA sends `X-BGG-Session: <token>` on authenticated requests; the Function converts this to `Cookie: sessionid=<token>` before forwarding to BGG. `Set-Cookie` is never relayed to the browser. The Function sets `cors: true` to allow requests from the SPA's origin.

The `VITE_BGG_API_BASE` environment variable selects which proxy is used: `/bggapi` in development, the Firebase Function URL in production.
