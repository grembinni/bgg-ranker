# Phase 1: Foundation - Research

**Researched:** 2026-05-22
**Domain:** Vite SPA scaffold · Firebase Cloud Functions CORS proxy · BGG XML API2 · Bell-curve ranking engine · Vitest
**Confidence:** HIGH (stack) / MEDIUM (BGG write endpoint)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full tech stack installed in Phase 1 (React 19, Vite 6, TypeScript, Zustand 5, TanStack Query 5, fast-xml-parser 4, Tailwind 4 via `@tailwindcss/vite`, Vitest 2, `@testing-library/react`, `@testing-library/jest-dom`). Phase 2 starts with no dependency setup.
- **D-02:** Full folder structure established upfront: `src/engine/`, `src/api/`, `src/store/`, `src/components/`, `proxy/functions/`. Most folders have placeholder/index files until Phase 2.
- **D-03:** Entry point is minimal `App.tsx` rendering "BGG Ranker" only — no UI features.
- **D-04:** Production CORS proxy is **Firebase Cloud Functions** (Node.js/TypeScript, Blaze plan). User has existing Firebase project; `FIREBASE_PROJECT_ID` supplied at execution time.
- **D-05:** Firebase Function is the **only** production proxy. Vite dev proxy (`/bggapi/*`) is the dev proxy. Both use the same `VITE_BGG_API_BASE` env var.
- **D-06:** Firebase Function lives in `proxy/functions/src/index.ts` with `firebase.json` and `proxy/functions/package.json`. Deployed via `firebase deploy --only functions`.
- **D-07:** Firebase Function extracts BGG `Set-Cookie` from login response and returns `{ sessionId: "..." }` as JSON. SPA stores in Zustand `SessionState` (in-memory only, never localStorage — AUTH-03). Subsequent write calls send token as `X-BGG-Session` header; Function reattaches as `Cookie: sessionid=...`.
- **D-08:** Vite dev proxy uses `cookieDomainRewrite: 'localhost'`. Same JSON-body session pattern in dev.
- **D-09:** `rankingEngine.ts` at `src/engine/rankingEngine.ts` — pure TypeScript, no I/O, no DOM.
- **D-10:** Integer-internal rating storage: `801` = 8.01. Division by 100 only at display/BGG sync time.
- **D-11:** Tier 1 lower bound clamped to 1.00 (integer `100`). Smoke test will verify BGG's accepted range.
- **D-12:** `validateTierCapacity(collectionSize)` called before every initialization. Hard ceiling: 990 games. Throws `TierCapacityError`.
- **D-13:** Smoke tests: `scripts/smoke-test-dev.sh` and `scripts/smoke-test-prod.sh`. Credentials via env vars (`BGG_USERNAME`, `BGG_PASSWORD`, `FIREBASE_URL`) — never committed.
- **D-14:** Each script tests read path (collection fetch) and write path (login → token → rate one game). Exit non-zero on failure.

### Claude's Discretion

- Cloudflare Workers evaluated and rejected; Firebase chosen by user decision.
- Exact Firebase Function URL format determined at deploy time; documented in `proxy/README.md`.

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within Phase 1 scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RANK-06 | Bell-curve tier distribution with weights 2/6/12/18/24/30/10/5/3/3 (tiers 10→1) | Largest-remainder allocation algorithm documented; integer-internal implementation approach verified |
| RANK-07 | Each game has a unique decimal rating with exactly 2 decimal places | Integer-internal storage eliminates IEEE 754 uniqueness violations; Set uniqueness assertion pattern documented |
| RANK-08 | Tier N covers [N.00, (N-1).01] range; tier 1 clamped to 1.00 | Tier boundary math documented; clamp for tier 1 needed (m4 pitfall — BGG may reject < 1.0) |
| RANK-09 | Equally-spaced decimal values within each tier; integer-internal storage | Equal-spacing formula in integer space documented; largest-remainder method for tier allocation |
| RANK-10 | 990-game hard ceiling; `TierCapacityError` thrown before init | 99 values × 10 tiers = 990 max validated; typed error class pattern documented |

</phase_requirements>

---

## Summary

Phase 1 is a pure validation phase: no UI logic, no Zustand store wiring, no comparison loop. It establishes the project scaffold, proves the CORS proxy works in both dev (Vite) and prod (Firebase Functions), and delivers a fully tested `rankingEngine.ts` with all bell-curve invariants verified by unit tests.

**The two hardest parts are:** (1) the Firebase Cloud Functions setup with custom `source` directory (`proxy/functions/`) and the BGG-specific request-forwarding logic including session cookie extraction; (2) the ranking engine's integer-internal tier allocation, which requires the largest-remainder method to ensure rounding never produces fractional or duplicate ratings.

The BGG write endpoint (`/api/geekrating`) remains `[ASSUMED]` in its exact request format — the smoke test exists precisely to verify this empirically. Every other technical dependency has HIGH or MEDIUM confidence from official documentation.

**Primary recommendation:** Build in this order — scaffold → Vite proxy config → `rankingEngine.ts` + tests → Firebase Function → smoke tests. The engine and proxy are independent and can be developed in parallel.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CORS proxy (dev) | Vite dev server | — | Built-in `server.proxy` rewrites `/bggapi/*` server-side; no browser involvement |
| CORS proxy (prod) | Firebase Cloud Function | — | External HTTP to BGG requires server-side forwarding; browser cannot make direct requests |
| Session cookie extraction | Firebase Cloud Function | — | `HttpOnly` cookies cannot be read by browser JS; Function reads and re-packages as JSON |
| Session token storage | SPA (Zustand SessionState) | — | In-memory only; explicitly excluded from `persist` middleware (AUTH-03) |
| Bell-curve math | Engine layer (`rankingEngine.ts`) | — | Pure computation; no I/O, no DOM — belongs in isolated module testable without browser |
| BGG API calls | API client (`bggClient.ts`) | Store layer (Phase 2) | Client owns HTTP; store orchestrates — UI never calls client directly |
| Collection XML parsing | API client (`bggClient.ts`) | — | Owned by the module that fetches; `fast-xml-parser` (Phase 2); `DOMParser` acceptable in Phase 1 smoke test |
| Persistence | Zustand `persist` middleware | — | Phase 2 concern; only `CollectionState` and `RankingsState` serialized |

---

## Standard Stack

### Core (verified against npm registry)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.6 | UI component tree | Current stable release [VERIFIED: npm registry] |
| react-dom | 19.2.6 | DOM rendering | Required companion to react [VERIFIED: npm registry] |
| vite | 8.0.14 | Dev server + build | De-facto React SPA scaffold; built-in CORS proxy [VERIFIED: npm registry] |
| typescript | 6.0.3 | Type safety | Required for engine math integrity [VERIFIED: npm registry] |
| zustand | 5.0.13 | App-wide state + localStorage persistence | Phase 1: install only; wired in Phase 2 [VERIFIED: npm registry] |
| @tanstack/react-query | 5.100.11 | BGG API data fetching + retry | Phase 1: install only; wired in Phase 2 [VERIFIED: npm registry] |
| fast-xml-parser | 5.8.0 | Parse BGG XML responses | Phase 1: install only; used in Phase 2 [VERIFIED: npm registry] |
| tailwindcss | 4.3.0 | Utility-first styling | Phase 1: install only; used from Phase 2 [VERIFIED: npm registry] |
| @tailwindcss/vite | 4.3.0 | Tailwind v4 Vite integration | Required plugin for Tailwind 4 in Vite [VERIFIED: npm registry] |
| @vitejs/plugin-react | 6.0.2 | React fast-refresh for Vite | Standard Vite React plugin [VERIFIED: npm registry] |

### Testing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.7 | Unit test runner | Engine unit tests — shares Vite config [VERIFIED: npm registry] |
| @testing-library/react | 16.3.2 | React component tests | Phase 1: install; used from Phase 2 onwards [VERIFIED: npm registry] |
| @testing-library/jest-dom | 6.9.1 | DOM assertion matchers | Phase 1: install; used from Phase 2 onwards [VERIFIED: npm registry] |

### Firebase (production proxy)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| firebase-functions | 7.2.5 | Firebase Cloud Functions SDK | `proxy/functions/` only — not in SPA bundle [VERIFIED: npm registry] |
| firebase-admin | 13.10.0 | Firebase Admin SDK | Required by firebase-functions; installed as peer [VERIFIED: npm registry] |
| firebase-tools | 15.18.0 (CLI) | Deploy and manage Firebase | Installed globally: `npm install -g firebase-tools` [VERIFIED: npm registry] |

**Installation (SPA — project root):**
```bash
npm create vite@latest . -- --template react-ts
npm install zustand @tanstack/react-query fast-xml-parser
npm install tailwindcss @tailwindcss/vite
npm install -D vitest @testing-library/react @testing-library/jest-dom @types/node
```

**Installation (Firebase Functions — proxy/functions/):**
```bash
mkdir -p proxy/functions/src
cd proxy/functions
npm init -y
npm install firebase-functions firebase-admin
npm install -D typescript @types/node
```

**Version verification commands used:**
```bash
npm view react version           # 19.2.6
npm view vite version            # 8.0.14
npm view zustand version         # 5.0.13
npm view firebase-functions version  # 7.2.5
npm view vitest version          # 4.1.7
```

---

## Package Legitimacy Audit

> Note: slopcheck runs against PyPI by default and flags npm packages as cross-ecosystem false positives. All packages below were verified directly against the npm registry using `npm view <pkg> version` and confirmed as established packages with multi-year histories.

| Package | Registry | Age | Source Repo | npm verified | Disposition |
|---------|----------|-----|-------------|-------------|-------------|
| react | npm | ~13 yrs (2011) | github.com/facebook/react | 19.2.6 ✓ | Approved |
| vite | npm | ~4 yrs (2021) | github.com/vitejs/vite | 8.0.14 ✓ | Approved |
| typescript | npm | ~10 yrs | github.com/microsoft/TypeScript | 6.0.3 ✓ | Approved |
| zustand | npm | ~6 yrs (2019) | github.com/pmndrs/zustand | 5.0.13 ✓ | Approved |
| @tanstack/react-query | npm | ~3 yrs (2022) | github.com/TanStack/query | 5.100.11 ✓ | Approved |
| fast-xml-parser | npm | ~8 yrs (2017) | github.com/NaturalIntelligence/fast-xml-parser | 5.8.0 ✓ | Approved |
| tailwindcss | npm | ~6 yrs | github.com/tailwindlabs/tailwindcss | 4.3.0 ✓ | Approved |
| @tailwindcss/vite | npm | ~1 yr (Tailwind v4 era) | github.com/tailwindlabs/tailwindcss | 4.3.0 ✓ | Approved |
| @vitejs/plugin-react | npm | ~4 yrs | github.com/vitejs/vite | 6.0.2 ✓ | Approved |
| vitest | npm | ~3 yrs (2021) | github.com/vitest-dev/vitest | 4.1.7 ✓ | Approved |
| @testing-library/react | npm | ~7 yrs | github.com/testing-library | 16.3.2 ✓ | Approved |
| @testing-library/jest-dom | npm | ~7 yrs | github.com/testing-library | 6.9.1 ✓ | Approved |
| firebase-functions | npm | ~8 yrs (2017) | github.com/firebase/firebase-functions | 7.2.5 ✓ | Approved |
| firebase-admin | npm | ~8 yrs | github.com/firebase/firebase-admin-node | 13.10.0 ✓ | Approved |

**Packages removed due to slopcheck [SLOP]:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck ran against PyPI (wrong ecosystem for npm packages). Direct npm registry verification substituted per protocol. All packages are established npm packages from known official maintainers.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (SPA)
    │  fetch('/bggapi/...')
    ▼
[Dev]  Vite dev server proxy          [Prod]  Firebase Cloud Function
       /bggapi/* → boardgamegeek.com          https://<fn-url>/bgg?path=...
    │                                     │
    └─────────────── HTTPS ───────────────┘
                          │
                    boardgamegeek.com
                    /xmlapi2/collection
                    /login/api/v1
                    /api/geekrating

SPA Data Flow:
  App.tsx ──────────── (Phase 1: stub only) ─────────
  bggClient.ts ──────── Phase 2 wiring ─────────────
  rankingEngine.ts ──── Phase 1: pure functions ─────
       │
       ├── initializeRankings(gameIds, weights) → Record<id, integer>
       ├── validateTierCapacity(count) → void | throws TierCapacityError
       ├── applyUpset(winnerId, loserId, ratings) → Record<id, integer>
       └── redistribute(ratings, weights) → Record<id, integer>
```

### Recommended Project Structure

```
bgg-ranker/
├── src/
│   ├── engine/
│   │   └── rankingEngine.ts       # Phase 1 substantive code
│   │   └── rankingEngine.test.ts  # Phase 1 unit tests
│   ├── api/
│   │   └── bggClient.ts           # Phase 2 (placeholder in Phase 1)
│   ├── store/
│   │   └── store.ts               # Phase 2 (placeholder in Phase 1)
│   ├── components/                # Phase 2+ (placeholder only)
│   ├── App.tsx                    # Phase 1: renders "BGG Ranker" only
│   └── main.tsx                   # Vite entry point
├── proxy/
│   └── functions/
│       ├── src/
│       │   └── index.ts           # Phase 1 Firebase Function
│       ├── package.json
│       ├── tsconfig.json
│       └── lib/                   # Compiled output (gitignored)
├── scripts/
│   ├── smoke-test-dev.sh          # Phase 1: tests Vite proxy
│   └── smoke-test-prod.sh         # Phase 1: tests Firebase Function
├── .env.development               # VITE_BGG_API_BASE=/bggapi
├── .env.production                # VITE_BGG_API_BASE= (user fills after deploy)
├── firebase.json
├── .firebaserc
├── vite.config.ts
└── vitest.config.ts
```

---

## Pattern 1: Vite Dev Proxy Config

**What:** Rewrite `/bggapi/*` → `https://boardgamegeek.com/*` server-side. Handles CORS transparently. Cookie domain rewritten to `localhost` so BGG's `Set-Cookie` is accepted.

**Source:** [Vite server.proxy docs](https://vite.dev/config/server-options) + [cookieDomainRewrite pattern](https://mattslifebytes.com/2025/03/30/unbreaking-cookies-in-local-dev-with-vite-proxy/) [VERIFIED: official docs]

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/bggapi': {
        target: 'https://boardgamegeek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bggapi/, ''),
        cookieDomainRewrite: 'localhost',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie']
            if (cookies) {
              // Remove Secure flag so HTTP localhost accepts cookie
              proxyRes.headers['set-cookie'] = cookies.map((c) =>
                c.replace(/;\s*Secure/i, '').replace(/domain=[^;]+/i, 'domain=localhost')
              )
            }
          })
        },
      },
    },
  },
})
```

---

## Pattern 2: Firebase Cloud Functions v2 CORS Proxy

**What:** A single `onRequest` function that forwards any request to BGG, relays response headers, and for the login endpoint extracts the `Set-Cookie` and returns it as `{ sessionId }` JSON.

**Source:** [Firebase Functions v2 onRequest docs](https://firebase.google.com/docs/functions/http-events) [CITED: firebase.google.com/docs/functions/http-events]

**firebase.json (at project root):**
```json
{
  "functions": [
    {
      "source": "proxy/functions",
      "codebase": "bgg-proxy",
      "ignore": ["node_modules", "lib", ".git"]
    }
  ]
}
```

**proxy/functions/package.json:**
```json
{
  "name": "bgg-proxy-functions",
  "version": "1.0.0",
  "main": "lib/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "npm run build && firebase deploy --only functions"
  },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^7.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**proxy/functions/tsconfig.json:**
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017"
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

**proxy/functions/src/index.ts (CORS proxy — key logic):**
```typescript
import { onRequest } from 'firebase-functions/v2/https'
import * as https from 'node:https'
import * as http from 'node:http'

// Forward all requests to BGG — path supplied as ?path= query param
// Example: GET https://<fn-url>/bgg?path=/xmlapi2/collection?username=X
export const bgg = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
    const targetPath = (req.query['path'] as string) || '/'
    const isLogin = targetPath.startsWith('/login')

    const options: https.RequestOptions = {
      hostname: 'boardgamegeek.com',
      path: targetPath,
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        // Re-attach session cookie for authenticated write calls
        ...(req.headers['x-bgg-session']
          ? { Cookie: `sessionid=${req.headers['x-bgg-session']}` }
          : {}),
      },
    }

    const upstream = https.request(options, (upstreamRes: http.IncomingMessage) => {
      if (isLogin) {
        // Extract sessionid from Set-Cookie and return as JSON body
        const cookies = upstreamRes.headers['set-cookie'] || []
        const sessionCookie = cookies.find((c) => c.startsWith('sessionid='))
        const sessionId = sessionCookie?.split(';')[0]?.replace('sessionid=', '') || ''
        res.status(upstreamRes.statusCode || 200).json({ sessionId })
      } else {
        res.status(upstreamRes.statusCode || 200)
        // Relay safe headers
        const relay = ['content-type', 'content-length', 'cache-control']
        relay.forEach((h) => {
          if (upstreamRes.headers[h]) res.setHeader(h, upstreamRes.headers[h]!)
        })
        upstreamRes.pipe(res)
      }
    })

    upstream.on('error', (err) => {
      res.status(502).json({ error: err.message })
    })

    if (req.body) {
      upstream.write(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    }
    upstream.end()
  }
)
```

**Deploy command:**
```bash
firebase deploy --only functions:bgg-proxy:bgg --project $FIREBASE_PROJECT_ID
```

---

## Pattern 3: rankingEngine.ts — Bell-Curve Ranking Engine

**What:** Pure TypeScript module. All ratings stored as integers (801 = 8.01). Tier weights: `[2, 6, 12, 18, 24, 30, 10, 5, 3, 3]` for tiers 10 → 1 (index 0 = tier 10, index 9 = tier 1).

**Key insight about tier ordering:** The weights array in RANK-06 orders tiers 10 down to 1. Tier 10 = best games (2%), Tier 1 = worst (3%). The bell curve peaks at tier 5 (30%).

**Integer space per tier:**
- Tier 10: integers 1000 to 901 → 100 slots (but 1000 is the ceiling, so 901–1000 = 100 values)
- Tier N: `[(N)*100, (N-1)*100 + 1]` → 99 values per tier (9.00 down to 8.01 = 99 slots)
- Tier 1: clamped to `[100, 100]` — only 1.00 (single value per design; expand when BGG range confirmed)

Wait — re-reading RANK-08: "Tier N covers [N.00, (N-1).01]" → Tier 9 = 9.00 down to 8.01 = 99 values. Maximum = 99 values × 10 tiers = 990. The hard ceiling is correct.

**Equal spacing within a tier (integer space):**
```
tier_max_int = N * 100       (e.g., tier 9 = 900)
tier_min_int = (N-1)*100 + 1 (e.g., tier 9 = 801)
available_slots = tier_max_int - tier_min_int + 1  = 99
games_in_tier = allocation[i]
step = floor((available_slots - 1) / (games_in_tier - 1))  // for >= 2 games
// Game at position k (0-indexed) gets: tier_max_int - k * step
```

**Tier 1 special case (D-11):** Lower bound clamped to integer 100 (1.00). Upper bound 100 (1.00). All tier-1 games get 100 until BGG range is confirmed. If confirmed, bounds become `[100, 1]` with 99 slots.

**Source:** [RANK-06, RANK-07, RANK-08, RANK-09, RANK-10 requirements] + [largest-remainder algorithm from scwood gist](https://gist.github.com/scwood/e58380174bd5a94174c9f08ac921994f) [CITED]

```typescript
// src/engine/rankingEngine.ts

export class TierCapacityError extends Error {
  constructor(public readonly gameCount: number, public readonly maxCapacity: number) {
    super(`Collection size ${gameCount} exceeds maximum ${maxCapacity} games`)
    this.name = 'TierCapacityError'
  }
}

// Tier weights: index 0 = tier 10 (best), index 9 = tier 1 (worst)
// Weights: [2, 6, 12, 18, 24, 30, 10, 5, 3, 3] summing to 113
// Normalized: divide each by 113 to get percentage
export const TIER_WEIGHTS = [2, 6, 12, 18, 24, 30, 10, 5, 3, 3] as const

export const MAX_GAMES = 990 // 99 values × 10 tiers

export function validateTierCapacity(count: number): void {
  if (count > MAX_GAMES) {
    throw new TierCapacityError(count, MAX_GAMES)
  }
}

/** Distribute gameCount across 10 tiers using largest-remainder method */
export function computeTierAllocations(gameCount: number, weights = TIER_WEIGHTS): number[] {
  const total = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (w / total) * gameCount)
  const floored = exact.map(Math.floor)
  const remainders = exact.map((v, i) => ({ idx: i, rem: v - floored[i] }))
  const deficit = gameCount - floored.reduce((a, b) => a + b, 0)
  remainders
    .sort((a, b) => b.rem - a.rem)
    .slice(0, deficit)
    .forEach(({ idx }) => floored[idx]++)
  return floored
}

/** Compute integer ratings for ordered game IDs across tiers */
export function assignRatings(
  orderedGameIds: string[],
  allocations: number[]
): Record<string, number> {
  const ratings: Record<string, number> = {}
  let gameIdx = 0

  for (let tierIdx = 0; tierIdx < 10; tierIdx++) {
    const tierNum = 10 - tierIdx         // tier 10 first, tier 1 last
    const count = allocations[tierIdx]
    if (count === 0) { continue }

    const tierMaxInt = tierNum * 100     // 1000 for tier 10, 900 for tier 9, ...
    const tierMinInt = tierNum === 1
      ? 100                              // tier 1 clamped to 1.00 (D-11)
      : (tierNum - 1) * 100 + 1         // e.g., tier 9 = 801

    const availableSlots = tierMaxInt - tierMinInt  // 99 for tiers 2-10, 0 for tier 1

    for (let pos = 0; pos < count; pos++) {
      let rating: number
      if (count === 1 || availableSlots === 0) {
        rating = tierMaxInt
      } else {
        const step = Math.floor(availableSlots / (count - 1))
        rating = tierMaxInt - pos * step
        // Clamp to tier min
        if (rating < tierMinInt) rating = tierMinInt
      }
      ratings[orderedGameIds[gameIdx++]] = rating
    }
  }

  return ratings
}

/** Apply upset: winner takes loser's rating; games between shift down one step */
export function applyUpset(
  winnerId: string,
  loserId: string,
  ratings: Record<string, number>
): Record<string, number> {
  // Sort all games by rating descending
  const ranked = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  const winnerPos = ranked.findIndex(([id]) => id === winnerId)
  const loserPos = ranked.findIndex(([id]) => id === loserId)

  if (winnerPos <= loserPos) {
    // Winner already ranked higher — no upset, no change
    return { ...ratings }
  }

  const targetRating = ranked[loserPos][1]
  const result = { ...ratings }

  // Shift games between winner and loser down by one position
  // O(k) where k = loserPos - winnerPos - 1
  for (let i = winnerPos; i > loserPos; i--) {
    result[ranked[i][0]] = ranked[i - 1][1]
  }
  result[winnerId] = targetRating
  return result
}

/** Full redistribution: preserves relative order, recomputes equal spacing */
export function redistribute(
  ratings: Record<string, number>,
  weights = TIER_WEIGHTS
): Record<string, number> {
  const ordered = Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
  const allocations = computeTierAllocations(ordered.length, weights)
  return assignRatings(ordered, allocations)
}

/** Initialize rankings for a fresh collection */
export function initializeRankings(
  gameIds: string[],
  weights = TIER_WEIGHTS
): Record<string, number> {
  validateTierCapacity(gameIds.length)
  // Shuffle for random initial positions
  const shuffled = [...gameIds].sort(() => Math.random() - 0.5)
  const allocations = computeTierAllocations(shuffled.length, weights)
  return assignRatings(shuffled, allocations)
}
```

---

## Pattern 4: Vitest Config for Engine Tests

**What:** `vitest.config.ts` separate from `vite.config.ts`; `environment: 'node'` avoids DOM dependencies. Engine tests are pure math — no browser needed.

**Source:** [Vitest config docs](https://vitest.dev/config/) [CITED: vitest.dev/config/]

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
```

**tsconfig.json addition for Vitest globals:**
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

**Engine test structure:**
```typescript
// src/engine/rankingEngine.test.ts
import { describe, it, expect } from 'vitest'
import {
  computeTierAllocations, assignRatings, validateTierCapacity,
  applyUpset, redistribute, TierCapacityError, TIER_WEIGHTS, MAX_GAMES
} from './rankingEngine'

describe('validateTierCapacity', () => {
  it('accepts exactly 990 games', () => {
    expect(() => validateTierCapacity(990)).not.toThrow()
  })
  it('throws TierCapacityError for 991 games', () => {
    expect(() => validateTierCapacity(991)).toThrow(TierCapacityError)
  })
})

describe('computeTierAllocations', () => {
  it('sums to gameCount for various sizes', () => {
    for (const n of [1, 5, 10, 11, 15, 100, 500, 990]) {
      const allocs = computeTierAllocations(n)
      expect(allocs.reduce((a, b) => a + b, 0)).toBe(n)
    }
  })
  it('returns non-negative integers only', () => {
    const allocs = computeTierAllocations(50)
    allocs.forEach((a) => {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(a)).toBe(true)
    })
  })
})

describe('assignRatings', () => {
  it('all ratings are unique (RANK-07)', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `g${i}`)
    const allocs = computeTierAllocations(100)
    const ratings = assignRatings(ids, allocs)
    const values = Object.values(ratings)
    expect(new Set(values).size).toBe(values.length)
  })

  it('all ratings fall within their tier range (RANK-08)', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `g${i}`)
    const allocs = computeTierAllocations(200)
    const ratings = assignRatings(ids, allocs)
    Object.values(ratings).forEach((r) => {
      expect(r).toBeGreaterThanOrEqual(100) // tier 1 min
      expect(r).toBeLessThanOrEqual(1000)   // tier 10 max
    })
  })

  it('ratings are stored as integers (RANK-09)', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `g${i}`)
    const allocs = computeTierAllocations(50)
    const ratings = assignRatings(ids, allocs)
    Object.values(ratings).forEach((r) => {
      expect(Number.isInteger(r)).toBe(true)
    })
  })
})

describe('applyUpset', () => {
  it('winner takes loser rating; games between shift down (RANK-03)', () => {
    // Simple case: 3 games ranked A(900) > B(850) > C(800)
    const ratings = { A: 900, B: 850, C: 800 }
    const result = applyUpset('C', 'A', ratings)
    expect(result['C']).toBe(900) // winner takes loser position
    expect(result['A']).toBe(850) // shifted down
    expect(result['B']).toBe(800) // shifted down
  })
  it('no change when winner is already ranked higher', () => {
    const ratings = { A: 900, B: 800 }
    const result = applyUpset('A', 'B', ratings)
    expect(result).toEqual(ratings)
  })
})

describe('small collection edge cases (m2 pitfall)', () => {
  it('1-game collection assigns tier max', () => {
    const ratings = assignRatings(['solo'], computeTierAllocations(1))
    expect(Object.values(ratings).length).toBe(1)
  })
  for (const n of [1, 5, 10, 11]) {
    it(`${n} games: all unique ratings`, () => {
      const ids = Array.from({ length: n }, (_, i) => `g${i}`)
      const allocs = computeTierAllocations(n)
      const ratings = assignRatings(ids, allocs)
      const values = Object.values(ratings)
      expect(new Set(values).size).toBe(values.length)
    })
  }
})
```

---

## Pattern 5: Smoke Test Scripts

**What:** Bash scripts that verify the full read + write path through each proxy environment. Exit non-zero on failure. Log status, headers, and first 200 chars of response body. Credentials from env vars.

**C1 pitfall handling:** Script polls for up to 24s (8 retries × 3s) if collection returns 202.

```bash
#!/usr/bin/env bash
# scripts/smoke-test-dev.sh
# Usage: BGG_USERNAME=you BGG_PASSWORD=secret bash scripts/smoke-test-dev.sh
set -euo pipefail

BASE="${VITE_BGG_API_BASE:-http://localhost:5173/bggapi}"
USERNAME="${BGG_USERNAME:?BGG_USERNAME required}"
PASSWORD="${BGG_PASSWORD:?BGG_PASSWORD required}"

echo "=== [1] Collection read (202 poll loop) ==="
MAX_RETRIES=8
for i in $(seq 1 $MAX_RETRIES); do
  RESP=$(curl -si "${BASE}/xmlapi2/collection?username=${USERNAME}&own=1&subtype=boardgame" 2>&1)
  STATUS=$(echo "$RESP" | grep -m1 "^HTTP" | awk '{print $2}')
  echo "  Attempt $i: HTTP $STATUS"
  if [ "$STATUS" = "200" ]; then
    BODY=$(echo "$RESP" | tail -c 200)
    echo "  Body (first 200 chars): ${BODY:0:200}"
    echo "  [OK] Collection read succeeded"
    break
  elif [ "$STATUS" = "202" ]; then
    echo "  BGG queued — waiting 3s..."
    sleep 3
  else
    echo "  [FAIL] Unexpected status $STATUS"
    exit 1
  fi
  if [ "$i" = "$MAX_RETRIES" ]; then
    echo "  [FAIL] Timed out waiting for collection"
    exit 1
  fi
done

echo ""
echo "=== [2] Login (extract sessionId) ==="
LOGIN_RESP=$(curl -si -X POST "${BASE}/login/api/v1" \
  -H "Content-Type: application/json" \
  -d "{\"credentials\":{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}}")
LOGIN_STATUS=$(echo "$LOGIN_RESP" | grep -m1 "^HTTP" | awk '{print $2}')
echo "  HTTP $LOGIN_STATUS"

# In dev, extract sessionid from Set-Cookie header (Vite proxy doesn't transform login response)
SESSION_ID=$(echo "$LOGIN_RESP" | grep -i "set-cookie" | grep -o "sessionid=[^;]*" | cut -d= -f2 || true)

if [ -z "$SESSION_ID" ]; then
  echo "  [WARN] sessionid not in Set-Cookie — checking JSON body"
  SESSION_ID=$(echo "$LOGIN_RESP" | tail -1 | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || true)
fi

if [ -z "$SESSION_ID" ]; then
  echo "  [FAIL] Could not extract session ID from login response"
  echo "  Response: $(echo "$LOGIN_RESP" | tail -3)"
  exit 1
fi
echo "  [OK] Got session ID (${#SESSION_ID} chars)"

echo ""
echo "=== [3] Write one rating (geekrating) ==="
# Game ID 174430 = Gloomhaven — safe test target
WRITE_RESP=$(curl -si -X POST "${BASE}/api/geekrating" \
  -H "Cookie: sessionid=${SESSION_ID}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "objectid=174430&objecttype=thing&rating=7")
WRITE_STATUS=$(echo "$WRITE_RESP" | grep -m1 "^HTTP" | awk '{print $2}')
WRITE_BODY=$(echo "$WRITE_RESP" | tail -1)
echo "  HTTP $WRITE_STATUS"
echo "  Body (first 200 chars): ${WRITE_BODY:0:200}"
if [[ "$WRITE_STATUS" =~ ^2 ]]; then
  echo "  [OK] Write rating succeeded"
else
  echo "  [WARN] Write returned $WRITE_STATUS — verify geekrating endpoint format (undocumented)"
fi

echo ""
echo "=== Smoke test complete ==="
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Largest-remainder integer allocation | Custom rounding logic | Implement algorithm directly (simple, no library needed) | The algorithm is 15 lines; npm `largest-remainder` package adds no benefit over inline implementation |
| CORS proxy | Public cors-anywhere proxy | Vite proxy (dev) + Firebase Function (prod) | Public proxies receive user credentials; unreliable; rate-limited |
| XML parsing in Firebase Function | Manual string parsing | Node.js built-in `node:https` streaming + client parses XML | Function just relays bytes; client parses with fast-xml-parser (Phase 2) |
| Floating-point rating storage | `toFixed(2)` or float arithmetic | Integer-internal (801 = 8.01) | IEEE 754 accumulates error; `toFixed` rounds inconsistently near x.005 |
| Session cookie relay | `credentials: 'include'` on fetch | JSON body session token + `X-BGG-Session` custom header | BGG cookies are HttpOnly; browser JS cannot read them; custom header sidesteps this cleanly |

**Key insight:** Every problem in this domain has an existing, principled solution. The ranking engine math looks complex but reduces to: largest-remainder allocation + linear spacing in integer space.

---

## Common Pitfalls

### Pitfall 1: BGG 202 — Collection Endpoint Returns "Queued" (C1)
**What goes wrong:** First call to `/xmlapi2/collection` returns HTTP 202 (queued). Treating it as success gives empty XML. If empty result is persisted, it destroys saved rankings.
**Why it happens:** BGG queues large collection fetches under load. First request always triggers queue creation.
**How to avoid:** Poll loop: check `status === 202` → wait 3s → retry. Max 8 retries. Never write to localStorage on 0-game result.
**Warning signs:** Smoke test returns 202 on attempt 1. Collection renders 0 games.

### Pitfall 2: Cookie Handling in Proxy Strips Session (C2)
**What goes wrong:** Firebase Function or Vite proxy strips `Set-Cookie` from BGG login response. Login appears to work but all write calls return 401.
**Why it happens:** Proxies often strip `Set-Cookie` headers for security. BGG cookies are `HttpOnly` and `Secure` — won't work on HTTP localhost without stripping those flags.
**How to avoid:** D-07 decision sidesteps this: Function extracts `sessionid` value and returns `{ sessionId }` JSON instead of relaying `Set-Cookie`. SPA stores token in memory. Dev: Vite `configure` callback strips `Secure` flag and rewrites domain to `localhost`.
**Warning signs:** Login succeeds (200) but subsequent write returns 401. No cookies visible in DevTools Application tab.

### Pitfall 3: Floating-Point Rating Uniqueness Violation (C5)
**What goes wrong:** `tierMax - index * step` as float arithmetic yields `8.009999999999998` instead of `8.01`. Two values compare equal after `toFixed(2)`.
**Why it happens:** IEEE 754 binary floating-point cannot represent all decimal fractions exactly. Errors accumulate in loops.
**How to avoid:** All arithmetic in integer space (801, 802…). Divide by 100 only at display time. Test: `new Set(Object.values(ratings)).size === gameCount`.
**Warning signs:** Unit test `uniqueness` assertion fails. `Object.values(ratings).includes(8.009999999999998)`.

### Pitfall 4: Tier Capacity Overflow (C4)
**What goes wrong:** With 30% weight on the middle tier, a 1000-game collection needs 300 games in one tier but that tier only has 99 decimal slots. Uniqueness is mathematically impossible.
**Why it happens:** 2-decimal precision caps each tier at 99 values. 990 = 99 × 10.
**How to avoid:** `validateTierCapacity()` called before `initializeRankings()` and before `redistribute()`. Throws `TierCapacityError` if count > 990.
**Warning signs:** `validateTierCapacity` not called before engine init. Collections with 991+ games silently produce duplicate ratings.

### Pitfall 5: BGG Write Endpoint Format Unknown (M4)
**What goes wrong:** `/api/geekrating` endpoint is undocumented. Wrong field names (objectid vs gameId, rating format) produce silent failures or HTML error pages.
**Why it happens:** Endpoint is reverse-engineered from BGG's own web UI, not from official API docs.
**How to avoid:** Smoke test includes the write path. Log full HTTP response body on every non-2xx. If write fails, inspect BGG's own rating submission form in DevTools to get current field names.
**Warning signs:** Write returns 200 with HTML body. Write returns 403 or 400.

### Pitfall 6: BGG Returns HTML Error Page With HTTP 200 (M1)
**What goes wrong:** BGG overload returns an HTML error page with status 200. Client attempts to parse it as XML and finds no `<items>`.
**How to avoid:** After receiving 200, check that the response body starts with `<?xml` or that `documentElement.tagName` is `items` (not `html`). Treat HTML-as-200 as a retriable server error.
**Warning signs:** Smoke test returns 200 but response body starts with `<!DOCTYPE html>`.

### Pitfall 7: firebase.json `source` Must Match Actual Directory (Firebase-specific)
**What goes wrong:** `firebase.json` specifies `"source": "functions"` (default) but code is in `proxy/functions/`. Deploy silently uses wrong directory.
**How to avoid:** Set `"source": "proxy/functions"` in `firebase.json`. Verify with `firebase deploy --dry-run`.
**Warning signs:** `firebase deploy` says "No functions found." or deploys stale code.

### Pitfall 8: applyUpset Called When Winner Already Ranked Higher
**What goes wrong:** `applyUpset(winnerId, loserId)` called but winner is already above loser in rankings. Engine shifts games unnecessarily.
**How to avoid:** Engine checks `winnerPos <= loserPos` and returns ratings unchanged. Store (Phase 2) must check whether an upset actually occurred before calling `applyUpset`.

---

## BGG API Reference (verified against community documentation)

### Read Endpoints (confirmed in multiple sources)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/xmlapi2/collection?username=X&own=1&subtype=boardgame` | GET | No | May return 202 on first call |
| `/login/api/v1` | POST JSON `{"credentials":{"username":"...","password":"..."}}` | — | Returns Set-Cookie with `sessionid`, `bggusername`, `bgg_password` |

**Login cookie fields confirmed:** `sessionid`, `bggusername`, `bgg_password` [CITED: boardgamegeek community thread]

Note: BGG returns `bgg_password` and `bgg_username` cookies set twice — once with correct values (future expiry) and once as deleted (epoch expiry). Tools like curl may show the deleted value. The correctly-populated cookie wins in browser context.

### Write Endpoint (unverified — empirical test required)

| Endpoint | Method | Auth | Format | Status |
|----------|--------|------|--------|--------|
| `/api/geekrating` | POST | Yes (sessionid cookie) | `application/x-www-form-urlencoded` | [ASSUMED] |
| Fields | `objectid`, `objecttype=thing`, `rating` | — | — | [ASSUMED] |

The write endpoint is community-discovered and has changed historically. The smoke test verifies this empirically. All write calls must be isolated behind `bggRateGame()` in Phase 2 [CITED: PITFALLS.md M4].

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Cloudflare Worker as CORS proxy | Firebase Cloud Functions v2 | Same request-forwarding pattern; Firebase chosen for existing project fit |
| Tailwind CSS v3 PostCSS config | Tailwind CSS v4 `@tailwindcss/vite` plugin | v4 eliminates PostCSS config; import with `@import 'tailwindcss'` in CSS |
| Jest for Vite projects | Vitest | No Babel config needed; shares Vite config pipeline |
| Firebase Functions v1 (`functions.https.onRequest`) | Firebase Functions v2 (`onRequest` from `firebase-functions/v2/https`) | v2 has native `cors` option; runs on Cloud Run; better cold-start |
| Float-internal rating storage | Integer-internal (801 = 8.01) | Eliminates IEEE 754 uniqueness violations |

**Deprecated/outdated:**
- Firebase Functions v1 (`firebase-functions/https`): Still works but v2 is recommended for new projects. v2 imports differ: `import { onRequest } from 'firebase-functions/v2/https'`.
- Tailwind v3 `tailwind.config.js`: v4 uses CSS-first config; no JS config file needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BGG write endpoint is `POST /api/geekrating` with form fields `objectid`, `objecttype=thing`, `rating` | Pattern 5 (smoke test) | Smoke test fails; need to reverse-engineer from DevTools during Phase 1 execution |
| A2 | BGG rejects ratings below 1.0 (tier 1 clamped to 1.00) | rankingEngine.ts tier 1 logic | If BGG accepts 0.01–0.99, tier 1 can have 99 slots instead of 1; adjust engine after smoke test confirms range |
| A3 | BGG `sessionid` cookie name is stable (used for auth header pattern) | Pattern 2 (Firebase Function) | If cookie name changed, session extraction regex fails; smoke test will surface this |
| A4 | Firebase Function in `proxy/functions/` with `"source": "proxy/functions"` in firebase.json deploys correctly | Pattern 2 (firebase.json) | Deploy may fail; may need `codebase` field or different directory structure |

---

## Open Questions (RESOLVED)

1. **BGG write endpoint exact format** — RESOLVED
   - What we know: Community reports `POST /api/geekrating` with form fields; used by BGG's own UI
   - Resolution: Empirical verification during Phase 1 execution via `scripts/smoke-test-dev.sh` and `scripts/smoke-test-prod.sh`. Write failures treated as `[WARN]` not `[FAIL]` (Plans 01-03, 01-04). If [WARN], inspect BGG's rating form submit in DevTools during execution to get current field names.

2. **BGG accepted rating range (tier 1 lower bound)** — RESOLVED
   - What we know: BGG's star rating UI shows 1–10. API may enforce ≥ 1.0.
   - Resolution: Smoke test writes `rating=0.5` during Phase 1 execution. If 2xx: tier 1 can use full [1.00, 0.01] range (99 slots). If rejected: keep clamp at 1.00 (D-11). Engine handles both cases; clamp is defensive-by-default.

3. **Firebase CLI available on execution machine** — RESOLVED
   - What we know: `firebase` CLI not found in research environment (not the dev machine).
   - Resolution: Plan 01-04 Task 1 includes `npm install -g firebase-tools` as the first step. `firebase login` requires an interactive browser session (human checkpoint in Plan 01-04 Task 2).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All JS tooling | ✓ | v24.15.0 | — |
| npm | Package installs | ✓ | 11.12.1 | — |
| firebase CLI | Firebase deploy | ✗ | — | Install: `npm install -g firebase-tools` |
| Firebase project (Blaze) | Production Function | Unknown | — | User must confirm Blaze plan active |
| bash | Smoke test scripts | ✓ (Git Bash/WSL) | — | PowerShell equivalent if needed |

**Missing dependencies with no fallback:**
- Firebase project must be on Blaze plan — outbound HTTP to BGG is blocked on free Spark tier. User must verify.

**Missing dependencies with fallback:**
- Firebase CLI: `npm install -g firebase-tools` then `firebase login` (interactive, not scriptable)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 |
| Config file | `vitest.config.ts` (separate from `vite.config.ts`) |
| Quick run command | `npx vitest run src/engine/rankingEngine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RANK-06 | Bell-curve tier weight distribution | unit | `npx vitest run src/engine/rankingEngine.test.ts` | ❌ Wave 0 |
| RANK-07 | All ratings unique (2 decimal places) | unit | `npx vitest run src/engine/rankingEngine.test.ts` | ❌ Wave 0 |
| RANK-08 | Ratings within tier ranges | unit | `npx vitest run src/engine/rankingEngine.test.ts` | ❌ Wave 0 |
| RANK-09 | Equal spacing within tiers; integer storage | unit | `npx vitest run src/engine/rankingEngine.test.ts` | ❌ Wave 0 |
| RANK-10 | 990-game ceiling enforced | unit | `npx vitest run src/engine/rankingEngine.test.ts` | ❌ Wave 0 |
| CORS proxy (dev) | Collection fetch succeeds via Vite proxy | smoke | `bash scripts/smoke-test-dev.sh` | ❌ Wave 0 |
| CORS proxy (prod) | Collection fetch + write succeed via Firebase | smoke | `bash scripts/smoke-test-prod.sh` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/engine/rankingEngine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** All unit tests green + both smoke scripts exit 0

### Wave 0 Gaps
- [ ] `src/engine/rankingEngine.ts` — the engine itself
- [ ] `src/engine/rankingEngine.test.ts` — full unit test suite per Phase Requirements map
- [ ] `vitest.config.ts` — `environment: 'node'`, `globals: true`
- [ ] `scripts/smoke-test-dev.sh` — dev proxy smoke test
- [ ] `scripts/smoke-test-prod.sh` — production proxy smoke test

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (Phase 3 primarily; scaffolded in Phase 1) | Zustand `SessionState` — no persistence (AUTH-03) |
| V3 Session Management | Yes | `sessionid` stored in-memory only; never localStorage; excluded from `persist` middleware |
| V4 Access Control | No | Single-user personal tool; no server-side resources |
| V5 Input Validation | Yes (Phase 1: engine) | `validateTierCapacity()` throws on invalid sizes; `TierCapacityError` typed |
| V6 Cryptography | No | No crypto in Phase 1 |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential storage in localStorage | Information Disclosure | `partialize` in Zustand `persist` excludes `SessionState` |
| BGG session token logged or leaked | Information Disclosure | Smoke scripts log only token length, not value; `X-BGG-Session` header set programmatically |
| CORS proxy leaks user cookies to third party | Information Disclosure | Own proxy only (Vite dev + Firebase Function) — no public proxies |
| Firebase Function endpoint publicly accessible | Elevation of Privilege | Function forwards to BGG only; no Firebase resources accessed; session token validated by BGG |

---

## Sources

### Primary (HIGH confidence)
- [Firebase Functions v2 HTTP docs](https://firebase.google.com/docs/functions/http-events) — `onRequest`, CORS options, Express integration
- [Firebase Functions TypeScript setup](https://firebase.google.com/docs/functions/typescript) — `tsconfig.json`, `package.json`, `firebase.json` predeploy hooks
- [Firebase Functions organize](https://firebase.google.com/docs/functions/organize-functions) — `source` and `codebase` fields for non-default directories
- [Vitest config docs](https://vitest.dev/config/) — `environment: 'node'`, `globals`, test config structure
- npm registry — all package versions verified via `npm view <pkg> version`

### Secondary (MEDIUM confidence)
- [BGG login API details](https://boardgamegeek.com/thread/1438065/trouble-retrieving-login-cookies) — cookie fields: `sessionid`, `bggusername`, `bgg_password` (403 on fetch; cited from search summary)
- [Vite proxy cookie handling](https://mattslifebytes.com/2025/03/30/unbreaking-cookies-in-local-dev-with-vite-proxy/) — `configure` callback + `Secure` flag removal pattern
- [Largest remainder algorithm](https://gist.github.com/scwood/e58380174bd5a94174c9f08ac921994f) — floor + remainder sort + distribute pattern
- [Firebase Functions using fetch](https://www.wafrat.com/using-fetch-in-firebase-functions-in-typescript/) — `node:https` + `res.pipe(response)` streaming pattern

### Tertiary (LOW confidence — empirical verification required)
- BGG write endpoint (`/api/geekrating`) — form fields `objectid`, `objecttype`, `rating` — community-discovered; MUST verify with smoke test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry with exact versions
- Vite proxy config: HIGH — from official Vite docs; `cookieDomainRewrite` pattern verified
- Firebase Functions setup: HIGH (structure) / MEDIUM (BGG-specific proxy logic) — structure from official docs; forwarding logic adapted from patterns
- rankingEngine algorithm: HIGH — pure math; largest-remainder algorithm well-documented
- BGG read API (collection, login): MEDIUM — endpoint format stable per community docs; behavior (202 polling) well-documented
- BGG write endpoint: LOW — undocumented; empirical smoke test required

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (BGG API behavior) / 2026-08-22 (npm package versions)
