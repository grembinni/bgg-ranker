# Phase 5: Production Deploy (Render) - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 8 (create/modify) + 5 (delete)
**Analogs found:** 6 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `proxy/server/server.js` | service (reverse-proxy/middleware) | request-response (HTTP relay + session cache) | `vite.config.ts` (lines 11-90) for cookie logic; `proxy/functions/src/index.ts` for Express/Node-server request shape | role-match (composite: two analogs) |
| `proxy/server/package.json` | config | — | `proxy/functions/package.json` | exact (structural) |
| `render.yaml` | config | — | `firebase.json` (same "infra-as-code service descriptor" role, different platform) | role-match |
| `scripts/smoke-test-render.mjs` | test (integration/smoke) | request-response, batch (multi-step read+write) | `src/api/bggClient.ts`'s `poll202Loop` (lines 91-115) for retry-loop shape | role-match (pattern-only, no direct test-file analog exists) |
| `.env.production` | config | — | `.env.development` (sibling env file, same key) | exact |
| `proxy/README.md` | docs | — | `proxy/README.md` (self, being rewritten) | n/a (full rewrite) |
| `proxy/functions/` (deleted) | — | — | — | n/a (deletion) |
| `firebase.json`, `.firebaserc` (deleted) | — | — | — | n/a (deletion) |

## Pattern Assignments

### `proxy/server/server.js` (service, request-response)

**Primary analog (cookie/session logic):** `vite.config.ts` lines 11-90
**Secondary analog (Node HTTP server shape / Express-adjacent structure):** `proxy/functions/src/index.ts` (full file, 55 lines)

This is the single most important file this phase produces. It must merge two analogs: the *proven* cookie-relay logic from `vite.config.ts` (dev proxy, using Node's `http-proxy` hooks) translated into Express request/response semantics, combined with the *routing shape* (login-branch vs. catch-all forward) from the old Firebase Function — but explicitly must **not** copy the Firebase Function's single-cookie bug.

**Session cache declaration** (`vite.config.ts` lines 18-22):
```typescript
const devSession = env.BGG_DEV_SESSION
// Stores the full cookie string from the last successful login.
// BGG requires all three cookies (SessionID + bggusername + bggpassword)
// for private collection reads and writes.
let proxySession: string | null = null
```
Port as a module-scoped `let proxySession = null` at the top of `server.js` (no `devSession` env-var equivalent needed in prod — that was dev-only).

**Outbound request cookie injection** (`vite.config.ts` lines 24-40):
```typescript
proxy.on('proxyReq', (proxyReq, req) => {
  if (req.url?.includes('/login/api/v1')) return
  const xBggSessionRaw = req.headers['x-bgg-session'] as string | undefined
  proxyReq.removeHeader('x-bgg-session')
  // Sanitize before cookie injection — reject values with chars outside [A-Za-z0-9_-]
  // to prevent CRLF or semicolon injection into the forwarded Cookie header (CR-02).
  const xBggSession = xBggSessionRaw && /^[A-Za-z0-9_-]+$/.test(xBggSessionRaw)
    ? xBggSessionRaw
    : undefined
  const session = proxySession ?? devSession ?? (xBggSession ? `SessionID=${xBggSession}` : null)
  if (session) proxyReq.setHeader('Cookie', session)
})
```
Translate to Express: read `req.headers['x-bgg-session']`, apply the same `^[A-Za-z0-9_-]+$` regex guard (this exact regex is the security control — carry it forward verbatim, do not weaken it), then compute `cookieHeader = isLogin ? undefined : (proxySession ?? (xBggSession ? \`SessionID=${xBggSession}\` : undefined))` before making the outbound `https.request()` call. Drop the `devSession` fallback (dev-only concept).

**Login-response interception / Set-Cookie capture** (`vite.config.ts` lines 41-73):
```typescript
proxy.on('proxyRes', (proxyRes, req: IncomingMessage, res: ServerResponse) => {
  const cookies = proxyRes.headers['set-cookie']
  if (req.url?.includes('/login/api/v1')) {
    const sessionCookie = (cookies ?? []).find((c) => /^sessionid=/i.test(c))
    const sessionId = sessionCookie?.split(';')[0]?.replace(/^sessionid=/i, '') ?? ''
    if (sessionId) {
      // Store all non-deleted cookies for authenticated subsequent requests
      proxySession = (cookies ?? [])
        .filter((c) => !c.includes('Max-Age=0'))
        .map((c) => c.split(';')[0])
        .join('; ')
    }
    const body = JSON.stringify({ sessionId })
    // Always respond 200: we synthesize a new JSON body regardless of BGG's
    // status code (which may be 204 on success, 400 on bad credentials).
    // A 204 body would be silently dropped by the browser's fetch API.
    ...
    return
  }
  ...
})
```
This is the exact logic to port line-for-line into the Express route's login branch, using `upstreamRes.headers['set-cookie']` from Node's `https` module (native array — see RESEARCH.md Pitfall 1, do NOT use `fetch()` + `.get('set-cookie')`). Key invariants to preserve:
- `cookies.filter((c) => !c.includes('Max-Age=0'))` — excludes cookie-deletion directives from the cache.
- `.map((c) => c.split(';')[0]).join('; ')` — strips cookie attributes (Path, Domain, Expires, etc.), keeps only `name=value` pairs joined for a `Cookie:` header.
- `Set-Cookie` is **never** relayed back to the browser on the login path — only the synthesized `{sessionId}` JSON body is returned (AUTH-03 / D-08).
- Non-login responses: pipe status + body straight through unmodified (per CLAUDE.md's 202-passthrough rule — the proxy must not swallow/alter a 202).

**Routing shape (branch-on-path)** — from `proxy/functions/src/index.ts` lines 7-11:
```typescript
export const bgg = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
    const targetPath = req.path || '/'
    const isLogin = targetPath.startsWith('/login')
```
Use this `isLogin = req.path.startsWith('/login')` branch structure as the Express route's top-level dispatch — but replace the single-cookie `Cookie: sessionid=${req.headers['x-bgg-session']}` (lines 19-22 of that file) with the `vite.config.ts` full-cookie-cache logic above. **Do not port the single-cookie line itself** — it is the confirmed bug D-07 exists to fix.

**Upstream request construction (`https` module, native array cookies)** — from `proxy/functions/src/index.ts` lines 13-24 and 45-53:
```typescript
const options: https.RequestOptions = {
  hostname: 'boardgamegeek.com',
  path: targetPath,
  method: req.method,
  headers: {
    'Content-Type': req.headers['content-type'] || 'application/json',
    ...
  },
}
const upstream = https.request(options, (upstreamRes: http.IncomingMessage) => { ... })
upstream.on('error', (err: Error) => {
  res.status(502).json({ error: err.message })
})
if (req.body) {
  upstream.write(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
}
upstream.end()
```
This is the correct low-level pattern (native `https` module — avoids the fetch/`getSetCookie()` pitfall entirely by construction). Reuse this shape verbatim for the outbound call in the new Express handler; `hostname: 'boardgamegeek.com'` must stay hardcoded (SSRF mitigation — never derive from client input, per RESEARCH.md Security Domain).

**Safe-header relay on non-login paths** (`proxy/functions/src/index.ts` lines 36-40):
```typescript
const safeHeaders = ['content-type', 'content-length', 'cache-control']
safeHeaders.forEach((h) => {
  if (upstreamRes.headers[h]) res.setHeader(h, upstreamRes.headers[h]!)
})
upstreamRes.pipe(res)
```
Keep this allowlist approach for relaying upstream headers back to the browser (never blanket-relay all headers, which would leak `Set-Cookie`).

**Health check route** — no analog exists (new for this phase, needed by `render.yaml`'s `healthCheckPath: /healthz`). Simple `app.get('/healthz', (req, res) => res.sendStatus(200))`.

**CORS middleware** — no analog exists (Firebase's `onRequest({ cors: true })` was a one-line platform flag, not comparable to the `cors` npm package's Express middleware). Use `app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }))` per RESEARCH.md's Standard Stack recommendation.

---

### `proxy/server/package.json` (config)

**Analog:** `proxy/functions/package.json` (full file, 21 lines)
```json
{
  "name": "bgg-proxy-functions",
  "version": "1.0.0",
  "main": "lib/index.js",
  "engines": {
    "node": "20"
  },
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
Follow this file's shape (name, engines, scripts, dependencies) but swap contents entirely per D-03/RESEARCH.md's plain-JS recommendation:
- `"main": "server.js"` (no `lib/` build output — no TS compile step)
- `"scripts": { "start": "node server.js" }` (matches `render.yaml`'s `startCommand: npm start`)
- `"dependencies": { "express": "^5.2.1", "cors": "^2.8.6" }` (no devDependencies needed if staying plain JS)
- `"engines": { "node": "20" }` — keep this field for consistency even though RESEARCH.md's Pitfall 4 notes Render may not honor it alone (hence the belt-and-suspenders `NODE_VERSION` envVar in `render.yaml`).

---

### `render.yaml` (config)

No direct in-repo analog for Render Blueprint syntax (new platform this phase). `firebase.json` fills the equivalent *role* (declarative service descriptor keeping the old proxy platform's config in git) but the schema is entirely different — treat RESEARCH.md's Code Examples section as the authoritative template rather than porting `firebase.json`'s structure:

```yaml
# From RESEARCH.md Code Examples (CITED: render.com/docs/blueprint-spec)
services:
  - type: web
    name: bgg-ranker-proxy
    runtime: node
    plan: free
    region: oregon
    rootDir: proxy/server
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /healthz
    envVars:
      - key: NODE_VERSION
        value: 20.18.0
      - key: ALLOWED_ORIGIN
        value: "*"
        sync: false
```
Note the parallel to `firebase.json`'s `"source": "proxy/functions"` scoping field → `rootDir: proxy/server` here serves the same "which subdirectory does this service definition apply to" purpose.

---

### `scripts/smoke-test-render.mjs` (test, batch/request-response)

**No direct smoke-test-file analog exists** (confirmed — no `scripts/` directory in repo). Two indirect pattern sources:

**Retry-loop shape** — `src/api/bggClient.ts` lines 91-115 (`poll202Loop`):
```typescript
export async function poll202Loop(url: string, init?: RequestInit): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, init)
    if (res.status === 202) {
      if (attempt === MAX_RETRIES) {
        throw new Error('BGG collection fetch timed out after 8 retries')
      }
      await delay(RETRY_DELAY_MS)
      continue
    }
    if (!res.ok) {
      throw new Error('BGG API error: HTTP ' + res.status)
    }
    const text = await res.text()
    ...
    return text
  }
  throw new Error('Poll loop exhausted')
}
```
Mirror this attempt-count + delay + throw-on-exhaustion shape for the smoke test's cold-start-tolerant retry wrapper (RESEARCH.md's `withColdStartRetry` skeleton already does this — use that skeleton, structurally modeled on `poll202Loop`).

**Client contract to exercise** — `src/api/bggClient.ts` lines 119-175 (`bggLogin`, `bggRateGame`) define the exact request/response shapes the smoke test must replicate against the live Render URL:
- `bggLogin`: `POST {BASE}/login/api/v1`, JSON body `{credentials:{username,password}}`, expects `{sessionId}` JSON back (not `Set-Cookie` — the proxy already translates this per D-07/D-08).
- `bggRateGame`: `PUT {BASE}/api/collectionitem/{collId}`, header `X-BGG-Session: <sessionId>`, JSON body `{item:{collid, objecttype:'thing', objectid, rating}}`.
- `fetchCollection`: `GET {BASE}/xmlapi2/collection?username=X&own=1|rated=1&subtype=boardgame...`, optional `X-BGG-Session` header.

The smoke test should call these same paths/methods/bodies directly (not import `bggClient.ts` itself, since that's a browser-oriented module using `import.meta.env`) — reproduce the request shapes standalone in the `.mjs` script.

---

### `.env.production` (config, modify)

**Analog:** `.env.development` (sibling file, same `VITE_BGG_API_BASE` key, different value — dev uses `/bggapi`).

Per RESEARCH.md's Runtime State Inventory: current `.env.production` holds `VITE_BGG_API_BASE=https://us-central1-<PROJECT_ID>.cloudfunctions.net/bgg` (Firebase placeholder format). Single-line edit: replace with the live Render service URL once deployed (e.g. `https://bgg-ranker-proxy.onrender.com`). No other changes to this file.

---

### `proxy/README.md` (docs, full rewrite)

**Analog:** itself (current version, full 104 lines read above) — being rewritten, not pattern-copied. Preserve the useful *structural sections* (Production Deployment, Setup, Proxy Interface, Session Token Handling, Quick Verification) but:
- Replace all Firebase-specific setup steps (`firebase login`, `.firebaserc` project ID, Blaze plan requirement, `firebase deploy`) with Render equivalents (GitHub-connect via dashboard, `render.yaml` Blueprint sync, `npm start`).
- **Remove the stale `?path=` query-param convention entirely** (lines 68-72 of the old file: `GET <FIREBASE_URL>?path=/xmlapi2/collection...`) — replace with the real `req.path`-based routing shape: `GET <RENDER_URL>/xmlapi2/collection?username=X&own=1&subtype=boardgame`.
- Fix the stale `/api/geekrating` endpoint reference (old README line 72) — the actual verified endpoint is `PUT /api/collectionitem/{collId}` (per `src/api/bggClient.ts` `bggRateGame`, confirmed in RESEARCH.md).
- Session Token Handling section (old lines 77-84) is still substantively correct and can be kept nearly verbatim — the `{sessionId}` JSON contract and "Set-Cookie never relayed to SPA" explanation are unchanged by the Render pivot (D-08).
- Update Quick Verification's curl example and smoke-test invocation to reference `RENDER_URL` env var and `node scripts/smoke-test-render.mjs` (not `bash scripts/smoke-test-prod.sh`, which never existed — D-09).

## Shared Patterns

### Cookie sanitization guard (security-critical, apply everywhere `X-BGG-Session` is read)
**Source:** `vite.config.ts` line 32
```typescript
const xBggSession = xBggSessionRaw && /^[A-Za-z0-9_-]+$/.test(xBggSessionRaw)
  ? xBggSessionRaw
  : undefined
```
**Apply to:** `proxy/server/server.js`'s request handler, before interpolating any client-supplied header value into the outbound `Cookie:` header. Prevents CRLF/header injection (ASVS V5, RESEARCH.md Security Domain).

### Hardcoded upstream host (SSRF mitigation)
**Source:** `proxy/functions/src/index.ts` line 14 (`hostname: 'boardgamegeek.com'`) and `vite.config.ts` line 13 (`target: 'https://boardgamegeek.com'`)
**Apply to:** `proxy/server/server.js` — the upstream host must never be derived from client input (query param, header, etc.). Both existing analogs already get this right; carry forward unchanged.

### Set-Cookie never relayed to browser on login
**Source:** `vite.config.ts` lines 58-71 and `proxy/functions/src/index.ts` lines 28-33
**Apply to:** `proxy/server/server.js`'s login branch — always synthesize `{sessionId}` JSON, never pass through the raw `Set-Cookie` header. Satisfies AUTH-03.

### Native array cookie handling (avoid `fetch()` merge trap)
**Source:** `proxy/functions/src/index.ts`'s use of Node's `https` module throughout (`upstreamRes.headers['set-cookie']` is a native array)
**Apply to:** `proxy/server/server.js` — use the `https`/`http` module (not `fetch()` + `.get('set-cookie')`) for the outbound BGG call, per RESEARCH.md Pitfall 1.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `render.yaml` | config (IaC) | — | No Render Blueprint has ever existed in this repo; `firebase.json` fills an analogous *role* but has an incompatible schema — use RESEARCH.md's Code Examples template instead. |
| CORS middleware block in `proxy/server/server.js` | middleware | request-response | Firebase's `onRequest({ cors: true })` was a platform-level one-line flag, not comparable to Express `cors` middleware configuration — no in-repo precedent for explicit `Access-Control-*` header setup. |
| `/healthz` route | route | request-response | New concept this phase (needed for Render's `healthCheckPath`); neither `vite.config.ts` nor the old Firebase Function has a health-check endpoint. |
| `scripts/smoke-test-render.mjs` (as a whole file) | test | batch | No `scripts/` directory exists anywhere in the repo prior to this phase; only indirect logic-shape analogs (`poll202Loop`) apply, not a file-level analog. |

## Metadata

**Analog search scope:** repo root (`vite.config.ts`, `firebase.json`, `.firebaserc`), `proxy/functions/` (full subtree), `proxy/README.md`, `src/api/bggClient.ts`, `.env.development`/`.env.production`
**Files scanned:** 8 read in full (all ≤ 105 lines — single-pass reads, no offset/limit needed)
**Pattern extraction date:** 2026-07-17
