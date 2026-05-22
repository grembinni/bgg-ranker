# Technology Stack

**Project:** BGG Ranker
**Researched:** 2026-05-22
**Confidence:** MEDIUM-HIGH

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.x | UI component tree | React 19 is the current stable release. Stable, enormous ecosystem, best fit for a card-comparison UI with frequent local state changes. |
| TypeScript | 5.4+ | Type safety | The ranking math (bell-curve spacing, decimal uniqueness invariants) is bug-prone without types. TS catches off-by-one errors at compile time. |
| Vite | 6.x | Dev server + build | De-facto React SPA scaffold in 2025. Sub-second HMR, native ESM, built-in dev proxy (critical for CORS), zero-config TypeScript. |

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.x | App-wide state + localStorage persistence | Zustand's `persist` middleware serializes state to localStorage with one line of config — satisfying PERSIST-01/02 without manual plumbing. React Context re-renders the entire tree on every comparison result (unacceptable for a rapid-fire comparison loop). |

### Data Fetching

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Query | 5.x | BGG API calls (read) | Handles retry, loading/error states, and deduplication. BGG's collection endpoint sometimes returns HTTP 202 (queued) — TanStack Query's `retry` and `refetchInterval` handle this cleanly. |

### XML Parsing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| fast-xml-parser | 4.x | Parse BGG API XML responses | BGG XML API2 returns XML, not JSON. `fast-xml-parser` converts XML to a typed JS object in one call; significantly cleaner than `DOMParser` + manual DOM traversal for BGG's deeply nested structures. |

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | Ideal for a card-comparison UI where layout, spacing, and color are composed inline. No CSS-in-JS runtime cost. The card side-by-side layout is four lines of Tailwind flex. |

### CORS Proxy Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vite `server.proxy` | (built-in) | Dev-time CORS bypass | Vite's dev server acts as the proxy. Configure `/bggapi/*` → `https://boardgamegeek.com/*` in `vite.config.ts`. Zero extra dependencies. |
| Cloudflare Worker | N/A (free tier) | Production CORS proxy | ~30-line Worker forwards requests to `boardgamegeek.com`, relays responses including `Set-Cookie`. Free tier (100k requests/day) is more than sufficient for personal use. Always warm — no cold-start latency. |

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | 2.x | Unit + integration tests | Shares Vite config pipeline — no extra Babel config. The ranking engine (bell-curve math, spacing invariants, uniqueness constraints) needs deterministic unit tests. |

---

## CORS Deep Dive — BGG XML API

**BGG serves no `Access-Control-Allow-Origin` headers.** Any browser `fetch()` to `boardgamegeek.com` is blocked. This affects ALL read AND write calls.

### Two-Environment Proxy Strategy

**Development (Vite dev server proxy):**

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/bggapi': {
        target: 'https://boardgamegeek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bggapi/, ''),
      },
    },
  },
})
```

All API calls use `/bggapi/xmlapi2/...` — Vite rewrites them to `boardgamegeek.com/xmlapi2/...` server-side.

**Production (Cloudflare Worker):** Deploy a Worker at `https://bgg-proxy.your-subdomain.workers.dev` that forwards requests to BGG, strips origin headers, sets `Access-Control-Allow-Origin: *` on the response, and relays `Set-Cookie` headers for auth.

**Environment variable pattern:**
```
VITE_BGG_API_BASE=/bggapi                                  # dev (Vite proxy)
VITE_BGG_API_BASE=https://bgg-proxy.example.workers.dev   # prod (Cloudflare Worker)
```

**Do NOT use public proxies** (cors-anywhere, allorigins.win) — unreliable, rate-limited, and would receive user credentials.

---

## BGG Authentication Deep Dive

### How BGG Auth Works

1. POST `https://boardgamegeek.com/login/api/v1` with JSON body `{"credentials": {"username": "...", "password": "..."}}`
2. BGG returns `200 OK` with `Set-Cookie: bggusername=...; sessionid=...` (HttpOnly, SameSite=None, Secure)
3. Subsequent write calls include these cookies

### The Browser Problem

BGG's cookies are `HttpOnly` — the browser cannot read or store them in JavaScript. You cannot drive this flow directly from a browser SPA.

### The Proxy Solution

The Cloudflare Worker must:
1. Accept the login POST from the browser
2. Forward it to `boardgamegeek.com/login/api/v1`
3. Extract the `Set-Cookie` response headers from BGG
4. Return the session cookie values in the JSON response body (NOT as `Set-Cookie`) so the SPA can store them in memory
5. For authenticated calls, the SPA sends the session token as a custom header; the Worker reattaches it as `Cookie` before forwarding to BGG

**Critical:** The session credentials slice in Zustand must be explicitly excluded from the `persist` middleware — credentials must never be written to localStorage (AUTH-03).

**Confidence:** MEDIUM — verify the exact BGG login endpoint format with `curl` during Phase 1.

---

## Installation

```bash
npm create vite@latest bgg-ranker -- --template react-ts
cd bgg-ranker
npm install zustand @tanstack/react-query fast-xml-parser
npm install tailwindcss @tailwindcss/vite
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

---

## Alternatives Considered

| Category | Recommended | Rejected | Why Rejected |
|----------|-------------|----------|--------------|
| Framework | React + Vite | Next.js | Next.js forces SSR/RSC onto a purely client app; no backend means no benefit |
| State | Zustand | Redux Toolkit | Overkill; RTK's structured boilerplate adds no value for one core state shape |
| State | Zustand | React Context | Context causes whole-tree re-renders — would cause jank in the comparison loop |
| XML | fast-xml-parser | DOMParser | DOMParser requires verbose imperative traversal; no TS inference |
| Styling | Tailwind v4 | shadcn/ui + Radix | Adds setup overhead; comparison UI is mostly custom cards, not complex primitives |
| Proxy (prod) | Cloudflare Worker | Express on Railway | Express free tiers have 30s cold-start latency; Workers are always warm |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| React + Vite + TypeScript | HIGH | Industry standard |
| Zustand persist for localStorage | HIGH | Stable, well-documented pattern |
| TanStack Query for BGG fetching | HIGH | Standard retry/polling use case |
| fast-xml-parser | HIGH | Dominant browser XML library |
| BGG CORS behavior | HIGH | Documented in BGG wiki and every OSS BGG client |
| BGG login endpoint format | MEDIUM | Verify with curl during Phase 1 |
| Cloudflare Worker proxy | MEDIUM | Pattern is correct; implementation needs BGG-specific testing |
| Tailwind v4 specifics | MEDIUM | Newer release; verify import syntax |

---

## Open Questions

1. Does `POST /login/api/v1` still return `sessionid` as a cookie, or has the auth flow changed?
2. Does BGG's collection endpoint always return HTTP 202 on first request, or only under load?
3. Tailwind v4 `@tailwindcss/vite` plugin — verify import syntax is stable in current release.
