# Walking Skeleton — BGG Ranker

**Phase:** 1 — Foundation
**Created:** 2026-05-22
**Purpose:** Record architectural decisions established in Phase 1 that all subsequent phases build on without renegotiating.

---

## What the Skeleton Proves

After Phase 1 executes, the following end-to-end path exists and is verified:

1. `npm run dev` starts Vite and renders "BGG Ranker" in the browser — SPA scaffold working.
2. `curl http://localhost:5173/bggapi/xmlapi2/collection?username=X` returns HTTP 200 or 202 with XML body — Vite dev proxy routes to BGG without a CORS error.
3. `npx vitest run` exits 0 with all ranking engine invariants verified — core computation proven correct.
4. `firebase deploy --only functions` deploys the proxy Function to Firebase — production proxy path exists and is deployable.
5. `bash scripts/smoke-test-dev.sh` exits 0 — dev end-to-end verified.
6. `bash scripts/smoke-test-prod.sh` exits 0 — prod end-to-end verified.

---

## Architectural Decisions

### Framework
| Decision | Value | Rationale |
|----------|-------|-----------|
| UI framework | React 19 + Vite 8 | Current stable; Vite dev proxy eliminates CORS for dev |
| Language | TypeScript (strict) | Engine math integrity requires type safety |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` | No PostCSS config; CSS-first; Phase 2 starts using immediately |
| State management | Zustand 5 | Installed in Phase 1; wired in Phase 2 |
| Data fetching | TanStack Query 5 | Installed in Phase 1; wired in Phase 2 |
| XML parsing | fast-xml-parser 5 | Installed in Phase 1; used in Phase 2 |
| Testing | Vitest 4 (node environment, globals: true) | Engine tests are pure math — no browser needed |

### Database / Storage
| Decision | Value | Rationale |
|----------|-------|-----------|
| Persistence layer | Browser localStorage | No server-side storage required; personal tool |
| Persistence library | Zustand `persist` middleware | Phase 2; `CollectionState` and `RankingsState` only |
| localStorage key format | `bgg-ranker:v1:<slice>` | Versioned to prevent stale schema corruption |
| Session credentials | Zustand `SessionState` in-memory ONLY | Never persisted (AUTH-03); `partialize` excludes `SessionState` |

### CORS Proxy
| Decision | Value | Rationale |
|----------|-------|-----------|
| Dev proxy | Vite `server.proxy` `/bggapi/*` → `boardgamegeek.com` | Built-in; no extra server; `cookieDomainRewrite: 'localhost'` handles cookies |
| Prod proxy | Firebase Cloud Functions v2 (`onRequest`) | User has existing Firebase project; Blaze plan required for outbound HTTP |
| Env var | `VITE_BGG_API_BASE` | `/bggapi` in dev, Firebase Function URL in prod |
| Session cookie strategy | Function extracts `sessionid` from `Set-Cookie`, returns `{ sessionId }` JSON; SPA stores in Zustand `SessionState` | HttpOnly cookies unreachable by browser JS; JSON body sidesteps this |
| Authenticated write pattern | SPA sends `X-BGG-Session` header; Function reattaches as `Cookie: sessionid=...` | Stateless proxy; no cookie relay needed |

### Authentication
| Decision | Value | Rationale |
|----------|-------|-----------|
| Auth mechanism | BGG native login (`POST /login/api/v1`) | No external auth service needed |
| Credential storage | Zustand `SessionState` in-memory only | AUTH-03: never localStorage, never disk |
| Session lifetime | Browser session (until tab close or explicit logout) | BGG session cookies are not persisted |

### Ranking Engine
| Decision | Value | Rationale |
|----------|-------|-----------|
| Rating storage | Integer-internal (`801` = 8.01) | Eliminates IEEE 754 float precision violations |
| Display / sync conversion | Divide by 100 at output boundary only | All engine arithmetic in integer space |
| Tier distribution | Bell-curve weights `[2,6,12,18,24,30,10,5,3,3]` tiers 10→1; sum=113 | RANK-06 |
| Tier allocation | Largest-remainder method | Ensures `sum(allocations) === gameCount` exactly |
| Tier ranges | Tier N: `[N*100, (N-1)*100 + 1]` integer space; 99 slots per tier | RANK-08 |
| Tier 1 lower bound | Clamped to `100` (1.00) | BGG may reject < 1.0 (Assumption A2; smoke test verifies) |
| Hard ceiling | 990 games (99 values × 10 tiers) | RANK-10; `validateTierCapacity()` throws `TierCapacityError` before init |
| Upset algorithm | `applyUpset()` is O(k) — only shifts games between winner and loser positions | RANK-03 |
| Redistribution | `redistribute()` is O(n) — only called on explicit user Refresh | REFRESH-01 |

### Deployment
| Decision | Value | Rationale |
|----------|-------|-----------|
| Firebase Function location | `proxy/functions/src/index.ts` | Colocated in repo; same commit history |
| Firebase config | `firebase.json` at project root; `"source": "proxy/functions"` | D-06; must match actual directory |
| Deploy command | `firebase deploy --only functions` | Standard Firebase CLI |
| Firebase plan required | Blaze (pay-as-you-go) | Spark free tier blocks outbound HTTP to BGG |

### Directory Layout
```
bgg-ranker/
├── src/
│   ├── engine/
│   │   ├── rankingEngine.ts        # Phase 1: full implementation
│   │   └── rankingEngine.test.ts   # Phase 1: full unit test suite
│   ├── api/
│   │   └── bggClient.ts            # Phase 1: placeholder; Phase 2: implementation
│   ├── store/
│   │   └── store.ts                # Phase 1: placeholder; Phase 2: implementation
│   ├── components/                 # Phase 1: empty placeholder; Phase 2+: components
│   ├── App.tsx                     # Phase 1: renders "BGG Ranker" only
│   ├── main.tsx                    # Vite entry point
│   └── index.css                   # Tailwind 4 import
├── proxy/
│   └── functions/
│       ├── src/
│       │   └── index.ts            # Phase 1: Firebase CORS proxy Function
│       ├── package.json
│       ├── tsconfig.json
│       └── lib/                    # Compiled output (gitignored)
├── scripts/
│   ├── smoke-test-dev.sh           # Phase 1: dev proxy smoke test
│   └── smoke-test-prod.sh          # Phase 1: prod proxy smoke test
├── .env.development                # VITE_BGG_API_BASE=/bggapi
├── .env.production                 # VITE_BGG_API_BASE= (user fills after deploy)
├── firebase.json                   # Firebase Function config
├── .firebaserc                     # Firebase project binding
├── vite.config.ts                  # Vite + Tailwind + proxy config
├── vitest.config.ts                # Vitest: node environment, globals
├── tsconfig.json                   # SPA TypeScript config
└── proxy/README.md                 # Documents Firebase Function URL format
```

---

## What Phase 2 Inherits (No Renegotiation)

- `rankingEngine.ts` public API: `initializeRankings`, `validateTierCapacity`, `applyUpset`, `redistribute`, `computeTierAllocations`, `assignRatings` — all accept/return integers
- `VITE_BGG_API_BASE` env var pattern for all `fetch` calls in `bggClient.ts`
- Zustand `persist` middleware must use `partialize` excluding `SessionState`
- `localStorage` key format `bgg-ranker:v1:<slice>`
- Firebase Function URL stored in `VITE_BGG_API_BASE` in `.env.production`
- `X-BGG-Session` header pattern for authenticated BGG write calls

---

## Open Items for Subsequent Phases

| Item | Assumption | Resolved By |
|------|-----------|-------------|
| BGG write endpoint exact fields | A1: `POST /api/geekrating` form `objectid`, `objecttype=thing`, `rating` | Phase 1 smoke test |
| BGG accepted rating range for tier 1 | A2: BGG rejects < 1.0; tier 1 clamped to 1.00 | Phase 1 smoke test |
| Firebase Function URL | Determined at deploy time | User documents in `.env.production` after Phase 1 deploy |
| Firebase Blaze plan active | A3: User must confirm before deploy | User confirms during Phase 1 execution |

---

*Walking Skeleton created: 2026-05-22*
*Phase 1 establishes all architectural foundations for Phases 2–4*
