# Phase 5: Production Deploy (Render) - Research

**Researched:** 2026-07-17
**Domain:** Node/Express reverse-proxy deployment on Render; Render Blueprint IaC; Vite production env-var build pipeline
**Confidence:** MEDIUM (Render platform mechanics are CITED from official docs; the cookie-relay architecture is VERIFIED against this repo's own working code)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Production CORS proxy moves from Firebase Cloud Functions to **Render**. Reason: simpler ops, avoids requiring a paid Blaze-plan Firebase project just for outbound HTTP. This supersedes PROJECT.md's Key Decisions row "Firebase Cloud Functions (Blaze) ... replaces Cloudflare Worker plan" — planner/executor should flag PROJECT.md for an update at phase close (not this phase's job to edit it directly).
- **D-02:** Delete the obsolete Firebase artifacts as part of this phase: `proxy/functions/` (including `src/index.ts`, `package.json`, `tsconfig.json`, `package-lock.json`), `firebase.json`, `.firebaserc`. Nothing to migrate — the Render service is a fresh implementation, not a port.
- **D-03:** Written in **Node + Express**. Chosen over a framework-less `http.createServer` for readability of the request-forwarding + cookie logic.
- **D-04:** Deployed via a **committed `render.yaml` Blueprint** (not manual dashboard configuration) — keeps the service definition in git, reviewable and repeatable.
- **D-05:** User already has a Render account; the GitHub repo is **not yet connected**. Plan must include the repo-connection step (via Render's Blueprint sync flow) but not account creation.
- **D-06:** Same client-side interface as before: `VITE_BGG_API_BASE` env var switches between `/bggapi` (dev) and the live Render URL (prod). No client-side (`src/`) changes expected beyond `.env.production`.
- **D-07:** The proxy **must relay all three BGG session cookies** (SessionID + bggusername + bggpassword) on authenticated write requests — mirror `vite.config.ts`'s dev-proxy logic exactly (capture the full `Set-Cookie` set on login, store it, replay it on subsequent authenticated requests). This is a verified, not speculative, requirement. The old Firebase Function only relayed a single `sessionid` cookie — a confirmed functional gap. Build the new Render proxy correctly from the start.
- **D-08:** Still keep the `X-BGG-Session` request-header convention for the SPA → proxy leg (client sends the header; proxy is the one that translates it into the full `Cookie:` header sent to BGG) — same client-facing contract as the old Firebase Function, so no `src/api/bggClient.ts`-side changes are needed.
- **D-09:** An automated real-credential smoke test is required (Success Criterion #4) — planner picks the implementation (bash or Node script). It does **not exist today** (confirmed: no `scripts/` directory exists in the repo at all).
- **D-10:** Smoke test must cover both collection read (BGG XML API) and the authenticated rating write (login → session → rate one game) against the live Render URL. Exits non-zero on failure.
- **D-11:** `proxy/README.md` gets rewritten for Render — full rewrite, not a patch (current version documents Firebase-specific setup + a stale `?path=` convention that never matched the actual `req.path`-based routing).

### Claude's Discretion

- Exact Express route structure / middleware choices for the new proxy (single catch-all route vs. separate `/login` and forwarding routes) — follow the old Function's `isLogin` branch-on-path pattern as a starting reference.
- Smoke test script language/format (D-09) — bash or Node, as long as it satisfies D-10's coverage requirement.
- Whether `render.yaml` lives at repo root or under `proxy/` — repo-root is more conventional for Render Blueprints; default to that unless it conflicts with existing root-level config.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. The Render-vs-Firebase pivot is a HOW decision (implementation vendor for the already-scoped "production CORS proxy" deliverable), not a new capability.

</user_constraints>

## Project Constraints (from CLAUDE.md)

- **BGG API has no CORS headers** — all requests must go through a proxy. CLAUDE.md's constraint line currently names "a Cloudflare Worker" for production — this is **stale** (superseded first by Firebase, now by Render). Not this phase's job to edit CLAUDE.md directly, but flag for a follow-up doc-accuracy fix; leaving it will mislead future sessions.
- **BGG collection endpoint may return HTTP 202** on first call — always poll with retry loop (3s delay, 8 retries max). Already implemented client-side in `poll202Loop()`; the proxy itself must not swallow or alter a 202 response — it must pass status codes through unmodified except on the `/login` interception path.
- **Use `?subtype=boardgame`** on collection requests by default — already client-side, no proxy action needed (the proxy forwards the raw path/query unmodified).
- **The rating write endpoint is undocumented — isolate behind a single adapter function.** Already true client-side (`bggRateGame()` in `bggClient.ts`). Note: CLAUDE.md's text says `/api/geekrating`; the actual, current, verified client code calls `PUT /api/collectionitem/{collId}` with a JSON body — this is the endpoint the new proxy must forward correctly (see Phase Requirements / Code Examples below). CLAUDE.md is stale on this specific path; do not build the proxy around `/api/geekrating`.
- **Credentials live in Zustand `SessionState` only, never persisted to localStorage.** Not affected by this phase — no `src/` changes. The proxy's own server-side session cache (see Architecture) is a *different* kind of state (in-memory, server-side, ephemeral) and does not touch localStorage; still worth flagging in the Security Domain section below since it is itself a session-storage mechanism.
- **UI components never call `bggClient` directly.** Not affected — no UI changes in this phase.
- Commit convention: `feat:`, `fix:`, `test:`, `chore:`, `docs:` — applies to this phase's commits (e.g. `chore(05): add render.yaml blueprint`, `docs(05): rewrite proxy README for Render`).

## Summary

Phase 5 replaces the never-deployed Firebase Cloud Function with a new Node + Express service deployed to Render via a committed `render.yaml` Blueprint. The core technical risk isn't Render itself — Render's Blueprint schema and deploy flow are simple and well documented — it's correctly porting the **cookie-relay architecture**. This repo already has exactly one proven-working implementation of BGG's 3-cookie session handling: `vite.config.ts`'s dev proxy `configure()` block. That code doesn't just reconstruct a `Cookie:` header per-request from the client's `X-BGG-Session` token (which is all the client ever sends back) — it caches the **entire** `Set-Cookie` set from the login response in a module-scoped variable and replays that cached blob on every subsequent authenticated request, ignoring what's in the client token for the cookie value itself. This is necessary because BGG requires `bggusername` and `bggpassword` cookies that are never returned to the browser at all (by design — the proxy intercepts `Set-Cookie` and returns only a synthesized `{sessionId}` JSON body to keep credentials out of client-observable state). The old Firebase Function skipped this and only forwarded `Cookie: sessionid=...` — a confirmed functional gap. The new Express service must replicate the vite proxy's server-side session cache pattern, not the old Function's naive per-request reconstruction.

A second, non-obvious technical risk: if the new proxy uses `fetch()` to call BGG (natural first instinct — no extra dependency needed on Node 18+), `Headers.get('set-cookie')` **merges multiple `Set-Cookie` headers into a single comma-joined string**, corrupting the exact 3-cookie split this proxy depends on. The fix is either `response.headers.getSetCookie()` (Node 18.14.1+ / standard `Headers` API, returns a proper array) or reverting to the `http`/`https` module (which exposes `set-cookie` as a native array, same approach the old Firebase Function used).

Render's mechanics are straightforward: a `render.yaml` Blueprint with `type: web`, `runtime: node`, `buildCommand`, `startCommand`, `plan: free`, and `envVars` is enough to deploy. The one step that **cannot** be done non-interactively by an executor agent is the initial GitHub-repo-to-Render connection (D-05) — Render's docs confirm this is a browser-only OAuth flow with no CLI or git-push-only equivalent for first-time connection. The plan must include an explicit human/browser checkpoint for this step. Render's free tier also spins the service down after 15 minutes of inactivity, with a ~30–60s cold-start on the next request — this affects smoke-test reliability (first request after a deploy or idle period may need a longer timeout or a warm-up ping) but does not block the phase goal.

**Primary recommendation:** Build the Express proxy as a small, dependency-light service (`express` + `cors`, both `[VERIFIED: npm registry]` OK) living at `proxy/server/` with its own `package.json`. Port `vite.config.ts`'s cookie store/replay logic verbatim (translated to Express's request/response objects), use Node's built-in `https` module (or `fetch()` + `getSetCookie()`) to avoid the multi-cookie merge trap, keep the existing `X-BGG-Session` / synthesized `{sessionId}` JSON contract unchanged, and write a Node-based smoke test (cross-platform on this Windows dev machine, avoids bash/curl quirks) that tolerates one cold-start retry.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| BGG session cookie capture/replay (3-cookie relay) | API/Backend (Render proxy) | — | Only the server can hold `bggusername`/`bggpassword` cookie values; browser JS never sees them (HttpOnly-equivalent by design, not by header flag) |
| CORS header issuance for the SPA origin | API/Backend (Render proxy) | — | BGG sets no CORS headers; the proxy is the only tier that can add them for the browser |
| `VITE_BGG_API_BASE` selection (dev vs prod proxy URL) | Browser/Client (build-time constant) | — | Vite bakes this in at build time; it is a static string, not a runtime lookup — belongs to the build/CDN tier, not a live backend decision |
| Session token storage (`sessionId`) | Browser/Client (Zustand, in-memory) | API/Backend (ephemeral cache) | Client holds the opaque token for UI/API-call purposes (AUTH-03: never localStorage); server independently holds the *real* cookie jar needed to satisfy BGG — two different "sessions" for two different reasons |
| Deployment/infra definition (`render.yaml`) | API/Backend (Render platform) | — | Infra-as-code for the backend service only; no CDN/static-site Blueprint is in scope for this phase |
| Static SPA hosting | *Out of scope this phase* | — | Success Criterion #5 only requires `npm run build` to succeed and the built files to reach BGG through the Render proxy with no CORS errors — it does not require deploying the SPA itself to a public host. See Open Questions. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | 5.2.1 `[VERIFIED: npm registry]` | HTTP server / routing for the proxy | D-03 locked decision; ubiquitous, minimal boilerplate for request/response + middleware access needed for cookie manipulation |
| `cors` | 2.8.6 `[VERIFIED: npm registry]` | CORS header issuance for the SPA origin | Standard Express-ecosystem CORS middleware; avoids hand-rolling `Access-Control-*` headers and OPTIONS preflight handling |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `typescript` + `@types/express` + `@types/cors` + `@types/node` | latest matching root repo's `typescript ~5.8.3` | Type safety consistent with rest of the codebase | Optional — see Architecture Patterns for the plain-JS-vs-TS tradeoff recommendation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `express` | framework-less `http.createServer` (old Firebase Function's style) | Rejected by D-03 — more boilerplate for cookie/header manipulation, no material benefit at this service's size |
| `cors` npm package | Hand-rolled `Access-Control-*` header setting | Don't hand-roll — easy to miss `OPTIONS` preflight or the `Vary: Origin` header; `cors` package handles both correctly |
| Native `fetch()` for the BGG upstream call | Node's `https`/`http` module | Either works, but `fetch()` requires explicit use of `response.headers.getSetCookie()` (not `.get('set-cookie')`) to avoid corrupting the 3-cookie set — see Common Pitfalls |
| TypeScript + `tsc` build step | Plain JavaScript (ESM, no build step) | Recommended: plain JS. Simpler Render `buildCommand` (`npm install` only, no compile step to fail), faster cold start, and "simpler ops" was the explicit reason for the Render pivot (D-01) in the first place. TS is optional discretion, not a locked requirement of D-03. |

**Installation:**
```bash
cd proxy/server
npm init -y
npm install express cors
```

**Version verification:** Verified live via `npm view <pkg> version` on 2026-07-17 — `express@5.2.1` (published 2025-12-01), `cors@2.8.6` (published 2026-01-22). Both current and actively maintained.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| express | npm | Long-established (published 2025-12-01 for this version; project itself is 10+ yrs old) | 108.5M/week | github.com/expressjs/express | OK | Approved |
| cors | npm | Long-established (published 2026-01-22 for this version) | 61.6M/week | github.com/expressjs/cors | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Both packages checked via `gsd-tools query package-legitimacy check --ecosystem npm express cors` — both `OK`, no `postinstall` scripts detected, both under the official `expressjs` GitHub org. No `[ASSUMED]` package names in this phase — `express` and `cors` are both explicitly named in D-03/the phase description and confirmed via the registry.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────┐
│   Browser (React SPA)       │
│   VITE_BGG_API_BASE = live  │
│   Render URL (baked in at   │
│   build time)                │
└──────────────┬──────────────┘
               │ 1. POST /login/api/v1  (credentials JSON)
               │ 2. GET  /xmlapi2/collection?username=...
               │ 3. PUT  /api/collectionitem/{collId}
               │    header: X-BGG-Session: <token>
               ▼
┌──────────────────────────────────────────────────────┐
│  Render Web Service (Express, proxy/server/)           │
│                                                          │
│  cors() middleware ── allows SPA origin                 │
│                                                          │
│  Module-scoped session cache:                           │
│    let proxySession: string | null = null                │
│  (mirrors vite.config.ts — the ONLY proven-working       │
│   3-cookie relay in this codebase)                       │
│                                                          │
│  Route: isLogin branch (path starts with /login)         │
│    → forward to BGG, capture full Set-Cookie set,        │
│      store in proxySession, return {sessionId} JSON      │
│      (Set-Cookie NEVER relayed to browser — AUTH-03)      │
│                                                          │
│  Route: all other paths (catch-all forward)               │
│    → sanitize X-BGG-Session header (CRLF/char guard)      │
│    → Cookie: proxySession ?? fallback-from-token          │
│    → forward req.path + query + method + body to BGG      │
│    → pipe BGG's response back (status, safe headers, body)│
└──────────────────────┬───────────────────────────────┘
                        │ HTTPS, hardcoded host:
                        │ boardgamegeek.com (never client-controlled —
                        │ prevents SSRF via arbitrary path/host injection)
                        ▼
              ┌───────────────────────────┐
              │   BoardGameGeek API         │
              │   /login/api/v1              │
              │   /xmlapi2/collection         │
              │   /api/collectionitem/{id}    │
              └───────────────────────────┘
```

### Recommended Project Structure
```
proxy/
└── server/                  # NEW — replaces proxy/functions/ (deleted per D-02)
    ├── server.js             # Express app: cors(), route handlers, cookie cache
    ├── package.json          # express, cors deps; "start": "node server.js"
    └── (no build step — plain ESM JS; see Alternatives Considered)
render.yaml                   # repo root (Claude's Discretion default) — Blueprint
scripts/
└── smoke-test-render.mjs     # NEW — D-09/D-10; Node script, real-credential smoke test
```

### Pattern 1: Server-Side Session Cache (the D-07 core requirement)
**What:** A module-scoped mutable variable (`proxySession`) that stores the *entire* `Set-Cookie` set from BGG's login response, replayed verbatim on every subsequent authenticated request — regardless of what value the client's `X-BGG-Session` header actually contains.
**When to use:** Every authenticated (non-login) forwarded request.
**Why this specific pattern (not naive per-request reconstruction):** The client only ever receives and can only ever send back a single opaque `sessionId` string (extracted from the `sessionid` cookie). BGG's `bggusername` and `bggpassword` cookies are captured server-side at login time and **never sent to the browser at all** — there is no way to reconstruct them from the client's token alone. Only a server-side cache of the original `Set-Cookie` set has the values needed.
**Example (adapted from the proven `vite.config.ts` reference, translated to Express):**
```javascript
// Source: this repo's vite.config.ts lines ~17-84 (proven working against live BGG)
let proxySession = null // module-scoped; wiped on process restart/cold start

app.use(async (req, res) => {
  const isLogin = req.path.startsWith('/login')
  const targetUrl = `https://boardgamegeek.com${req.path}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`

  // Sanitize before use — reject anything outside [A-Za-z0-9_-] to prevent
  // CRLF/header injection into the forwarded Cookie header (mirrors vite.config.ts CR-02)
  const rawToken = req.headers['x-bgg-session']
  const xBggSession = rawToken && /^[A-Za-z0-9_-]+$/.test(rawToken) ? rawToken : undefined

  const cookieHeader = isLogin
    ? undefined
    : (proxySession ?? (xBggSession ? `SessionID=${xBggSession}` : undefined))
    // Fallback note: after a cold start / process restart, proxySession is null even
    // though the client still holds a "valid" sessionId — this degrades to a
    // SessionID-only cookie, which may 401 on write endpoints that need all three
    // cookies. The SPA's existing 401 → re-auth flow (store.ts reAuthAndResume)
    // already handles this; document it, do not "fix" it in this phase.

  const upstreamRes = await forwardToUpstream(req, targetUrl, cookieHeader)

  if (isLogin) {
    const cookies = upstreamRes.headers['set-cookie'] ?? [] // native array via https module
    const sessionCookie = cookies.find((c) => /^sessionid=/i.test(c))
    const sessionId = sessionCookie?.split(';')[0].replace(/^sessionid=/i, '') ?? ''
    if (sessionId) {
      proxySession = cookies.filter((c) => !c.includes('Max-Age=0')).map((c) => c.split(';')[0]).join('; ')
    }
    res.json({ sessionId }) // Set-Cookie never relayed to browser (AUTH-03)
    return
  }
  // ...pipe upstreamRes status/body back to client
})
```

### Pattern 2: `render.yaml` Blueprint for a Node Web Service
**What:** Declarative service definition committed to git; Render syncs from this file on push.
**When to use:** D-04's locked deployment mechanism.
**Example:**
```yaml
# Source: https://render.com/docs/blueprint-spec (CITED, fetched 2026-07-17)
services:
  - type: web
    name: bgg-ranker-proxy
    runtime: node
    plan: free              # must be set explicitly — default is "starter" (paid), not free
    region: oregon           # default; fine for this use case
    rootDir: proxy/server     # build/start commands run from here; also scopes auto-deploy
                              # triggers to changes within this dir only
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /healthz
    envVars:
      - key: NODE_VERSION
        value: 20.18.0        # pin explicitly — community reports Render does not always
                               # reliably honor package.json "engines" alone
      - key: ALLOWED_ORIGIN
        value: "*"             # see Open Questions — no real prod SPA origin exists yet;
        sync: false             # sync:false lets this be changed in the dashboard later
                                 # without a code change/redeploy trigger
```
`plan: free`, `runtime: node`, `buildCommand`, `startCommand`, `healthCheckPath`, `rootDir`, `envVars` (with `sync: false` for dashboard-editable values, `generateValue: true` for random secrets, `fromService`/`fromDatabase` for cross-service refs) are all documented, current fields `[CITED: render.com/docs/blueprint-spec]`.

### Anti-Patterns to Avoid
- **Per-request cookie reconstruction from the client token alone** (the old Firebase Function's approach): silently drops `bggusername`/`bggpassword`, causing 401s on write endpoints. This is the confirmed bug D-07 exists to fix — do not reintroduce it.
- **Using `fetch()` + `Headers.get('set-cookie')`** to read BGG's response: merges multiple `Set-Cookie` headers into one comma-joined string, corrupting the 3-cookie split. Use `getSetCookie()` or the `https` module instead (see Common Pitfalls).
- **Forwarding an unsanitized `X-BGG-Session` header value directly into the `Cookie:` header**: without the `[A-Za-z0-9_-]+` regex guard, a malicious value could inject additional headers via CRLF. Carry forward the sanitization already present in `vite.config.ts`.
- **Hardcoding the Firebase Function URL format assumption anywhere in new code/docs** — the old `?path=` query-param convention (documented in the now-stale `proxy/README.md`) never actually matched the Function's real `req.path`-based routing. Don't let this stale convention leak into the new Render proxy's docs or smoke test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS header issuance + OPTIONS preflight | Manual `res.setHeader('Access-Control-Allow-Origin', ...)` | `cors` npm middleware | Easy to miss `Vary: Origin`, preflight `OPTIONS` handling, or credential-mode nuances; `cors` package is the ecosystem standard |
| Cold-start-tolerant retry logic for the smoke test | A bespoke ad hoc retry wrapper | Mirror `poll202Loop()`'s existing retry-with-delay pattern from `src/api/bggClient.ts` | The codebase already has a proven, simple retry-loop shape for exactly this kind of "service may not respond immediately" situation — reuse the pattern, don't invent a new one |
| Multi-`Set-Cookie` parsing | Manual string-splitting on commas | `response.headers.getSetCookie()` (fetch) or the `https` module's native `headers['set-cookie']` array | Comma-splitting breaks on cookies containing commas (e.g., `Expires=Wed, 09 Jun 2026...`); both native APIs already return a proper array |

**Key insight:** Every piece of BGG-cookie-handling logic this phase needs has already been solved correctly exactly once in this codebase (`vite.config.ts`). The job is porting that logic to Express, not re-deriving it from BGG's undocumented behavior.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the Firebase Function was a stateless per-invocation HTTP relay; no Firestore/Realtime DB/other datastore was ever used by it. | None |
| Live service config | None — `.firebaserc` still has the unfilled `YOUR_FIREBASE_PROJECT_ID` placeholder, confirming the Firebase Function was **never actually deployed** to a live project. There is no live Firebase resource to decommission via `firebase functions:delete` or the console. | None beyond deleting the local repo files (D-02) |
| OS-registered state | None — both Firebase Functions and Render Web Services are externally-hosted managed platforms; no local OS process (Task Scheduler, pm2, launchd/systemd) is registered for either. | None |
| Secrets/env vars | `.env.production`'s `VITE_BGG_API_BASE` currently holds a Firebase URL placeholder/format (`https://us-central1-<PROJECT_ID>.cloudfunctions.net/bgg`) and must be updated to the live Render service URL. This is a git-tracked, non-secret value (public API base URL) — a plain code edit, not a data migration. No Firebase-specific *secrets* exist in the repo (Blaze billing is tied to the GCP project itself, not to an app-level credential). | Code edit: update `.env.production`, then rebuild (Success Criterion #3/#5) |
| Build artifacts | `proxy/functions/lib/` (gitignored TypeScript compile output) becomes orphaned once `proxy/functions/src/` is deleted, but since it's gitignored there's nothing to clean up in git — deleting the source directory removes it structurally. No global npm installs (e.g. `firebase-tools`) require cleanup; that's a local dev-machine concern, out of scope. | None beyond deleting `proxy/functions/` (D-02) |

**Conclusion:** This is a low-risk migration from a *runtime-state* perspective — the Firebase side was never live, so there is nothing to drain, export, or reconcile. All work is additive (new Render service) plus a straightforward file deletion (D-02) and a single env-var value swap (D-06).

## Common Pitfalls

### Pitfall 1: `fetch()` merges multiple `Set-Cookie` headers into one string
**What goes wrong:** If the new Express proxy uses `fetch()` to call BGG and reads the response with `response.headers.get('set-cookie')`, it gets a single comma-joined string instead of 3 separate cookie strings — corrupting the exact cookie set D-07 requires the proxy to relay correctly.
**Why it happens:** The WHATWG Fetch `Headers` interface historically had no way to represent multiple values for the same header name distinctly; `get()` still joins them with `, ` for `Headers` objects that came from a fetch response.
**How to avoid:** Use `response.headers.getSetCookie()` (returns `string[]`, available Node 18.14.1+) if using `fetch()`. Alternatively, use Node's built-in `https`/`http` module (as the old Firebase Function did) — its `IncomingMessage.headers['set-cookie']` is natively an array, sidestepping the issue entirely.
**Warning signs:** Login works, but a subsequent authenticated write intermittently 401s with a cookie value that looks like it contains literal commas or is oddly truncated; BGG rejects a `Cookie:` header that visibly concatenates 3 cookies with commas instead of `; ` separators.
`[CITED: developer.mozilla.org/en-US/docs/Web/API/Headers/getSetCookie]`

### Pitfall 2: Render free-tier cold start silently wipes the in-memory session cache
**What goes wrong:** After 15 minutes of inactivity, Render spins the free-tier service down. The next request triggers a ~30–60s cold start on a **fresh process** — `proxySession` (Pattern 1) resets to `null`, even though the SPA's client-held `sessionId` still looks valid. The next authenticated write falls back to a `SessionID`-only cookie, which may 401 since `bggusername`/`bggpassword` are gone.
**Why it happens:** Free-tier Render services are not always-on; only paid plans (`starter`+) stay resident. In-memory state doesn't survive a process restart, by definition.
**How to avoid:** This is an inherent limitation of the module-scoped-cache architecture on a free tier — it is **not something to "fix" in this phase** (D-07 explicitly asks for the vite.config.ts pattern, which has this same characteristic even locally on dev-server restart). The existing SPA already has a 401-triggered re-auth flow (`reAuthAndResume`, referenced in STATE.md's accumulated context) that should already recover from this gracefully. Document the interaction; do not attempt to add persistent session storage (e.g., a database) — that would be scope creep beyond this phase's goal.
**Warning signs:** A user idle for >15 minutes mid-session, then attempting a sync, sees a 401 that resolves after re-login — expected behavior, not a bug to chase.

### Pitfall 3: `render.yaml`'s default plan is `starter` (paid), not `free`
**What goes wrong:** Omitting `plan: free` from the Blueprint silently provisions a paid tier.
**Why it happens:** Render's documented default for the `plan` field is `starter`.
**How to avoid:** Always set `plan: free` explicitly in the Blueprint for this phase's use case.
`[CITED: render.com/docs/blueprint-spec]`

### Pitfall 4: Render may not reliably honor `engines.node` alone
**What goes wrong:** Relying solely on `package.json`'s `engines.node` field to pin the Node version has been reported by users as inconsistently applied by Render's build system.
**Why it happens:** Documented community reports (Render's own community forum) note this gap between docs and observed behavior.
**How to avoid:** Set `NODE_VERSION` explicitly as a Blueprint `envVar` (or commit a `.node-version` file) rather than relying on `engines.node` alone.
`[CITED: community.render.com/t/render-doesnt-respect-engines-setting-in-package-json-as-the-docs-suggest/2805]` (community report, not official docs — treat as MEDIUM-LOW confidence corroborating signal, not a guarantee)

### Pitfall 5: Stale `?path=` query-param convention in `proxy/README.md`
**What goes wrong:** The current `proxy/README.md` documents a `GET <URL>?path=/xmlapi2/collection...` convention. The actual (already-fixed) Firebase Function code uses `req.path` directly — it never consumed a `path` query parameter. Following the doc's own curl examples today produces a request to a nonexistent route shape.
**Why it happens:** Docs drifted from code after a fix that was never back-documented.
**How to avoid:** D-11's full rewrite must document the real routing shape: the proxy mirrors BGG's own path structure directly (e.g., `GET <RENDER_URL>/xmlapi2/collection?username=X&own=1&subtype=boardgame`), not a `?path=` wrapper.

## Code Examples

### `render.yaml` (repo root)
```yaml
# Source: https://render.com/docs/blueprint-spec, https://github.com/render-oss/skills (CITED, fetched 2026-07-17)
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

### Existing client contract — do not change (`src/api/bggClient.ts`, verified current code)
```typescript
// bggLogin: POST {BASE}/login/api/v1, JSON body {credentials:{username,password}}, expects {sessionId} JSON back
// bggRateGame: PUT {BASE}/api/collectionitem/{collId}, header X-BGG-Session: <sessionId>,
//              JSON body {item:{collid, objecttype:'thing', objectid, rating}}
// fetchCollection: GET {BASE}/xmlapi2/collection?username=X&own=1|rated=1&subtype=boardgame..., header X-BGG-Session (optional)
```
The new Express proxy must forward these exact paths/methods/bodies unmodified to `https://boardgamegeek.com`, applying only the cookie-translation logic (Pattern 1) on top.

### Cold-start-tolerant smoke test skeleton (Node, D-09 recommendation)
```javascript
// scripts/smoke-test-render.mjs
// Usage: RENDER_URL=... BGG_USERNAME=... BGG_PASSWORD=... node scripts/smoke-test-render.mjs
const BASE = process.env.RENDER_URL
const USERNAME = process.env.BGG_USERNAME
const PASSWORD = process.env.BGG_PASSWORD

async function withColdStartRetry(fn, { retries = 3, delayMs = 15000 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn() } catch (err) {
      if (i === retries) throw err
      console.log(`  retrying after possible cold start (${i + 1}/${retries})...`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}
// 1. collection read (poll on 202, mirrors poll202Loop)
// 2. login → parse JSON {sessionId} (NOT Set-Cookie — proxy already translates this)
// 3. PUT /api/collectionitem/{collId} with X-BGG-Session header → expect 2xx
// process.exit(1) on any failed step
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Firebase Cloud Functions (Blaze plan) as production CORS proxy | Render Web Service via `render.yaml` Blueprint | This phase (2026-07-17 pivot, D-01) | No GCP billing setup required; simpler, git-native infra-as-code; free tier available (with cold-start tradeoff) |
| Single-cookie (`sessionid` only) relay | Full 3-cookie (SessionID + bggusername + bggpassword) relay, server-cached | This phase (D-07) | Fixes a confirmed write-path 401 risk that was never caught because the old Function was never actually deployed/tested against live BGG |

**Deprecated/outdated:**
- `proxy/functions/`, `firebase.json`, `.firebaserc`: deleted this phase (D-02).
- The `?path=` query-param convention in `proxy/README.md`: never matched actual code; corrected in the D-11 rewrite.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Plain JavaScript (no TypeScript build step) is recommended over TS+tsc for the new proxy | Standard Stack / Alternatives Considered | Low — this is Claude's Discretion territory (D-03 only locks Express, not language); if the planner/user prefers TS for consistency with the rest of the codebase, that's a valid alternative with a slightly more complex `buildCommand` |
| A2 | Production SPA hosting/origin is genuinely out of scope for this phase (only the proxy deploys) | Architectural Responsibility Map, Open Questions | Medium — if the user actually intended the SPA itself to also go live somewhere in this phase, the `ALLOWED_ORIGIN` CORS value and Success Criterion #5's verification method both need to be revisited; confirm during planning/discussion if ambiguous |
| A3 | `ALLOWED_ORIGIN: "*"` (wildcard CORS) is an acceptable default given the proxy uses a custom header (not cookies) for the SPA↔proxy leg, so no `credentials: true` is needed | Architecture Patterns Pattern 2, Security Domain | Low-Medium — a wildcard CORS origin means any web page could use this proxy as an open relay to BGG (though actual BGG auth still requires valid credentials); acceptable for a hobbyist single-user tool, but should be locked to a real origin once the SPA has a permanent production URL |
| A4 | Render does not always honor `engines.node` reliably (community-forum sourced, not official docs) | Common Pitfalls, Pitfall 4 | Low — worst case, explicit `NODE_VERSION` envVar is a no-op belt-and-suspenders; costs nothing to include even if the underlying report is outdated |

## Open Questions (RESOLVED)

1. **What is the production SPA's actual hosting origin (for CORS lock-down)?**
   - What we know: Phase 5's Success Criterion #5 only requires `npm run build` to succeed and the built static files to reach BGG through the Render proxy with no CORS errors — it does not name a specific static hosting target (Vercel/Netlify/GitHub Pages/Render Static Site). No hosting decision is recorded anywhere in PROJECT.md, ROADMAP.md, or CONTEXT.md.
   - What's unclear: Whether verification of SC#5 happens via `vite preview` (local, e.g. `http://localhost:4173`) hitting the live Render URL, or whether the user expects the SPA to also be genuinely publicly hosted by the end of this phase.
   - Recommendation: Treat SPA public hosting as out of scope for this phase (per the literal Success Criteria wording) and verify SC#5 via local `vite preview` against the live Render proxy. Use a wildcard or dashboard-editable (`sync: false`) `ALLOWED_ORIGIN` env var so CORS can be tightened later without a code change once real hosting is chosen. Flag this explicitly for user confirmation during planning if there's any ambiguity.
   - **RESOLVED:** Planner adopted the recommendation as-is. 05-03 verifies SC-5 via local `vite preview` against the live Render URL; 05-02's `render.yaml` sets `ALLOWED_ORIGIN` as a `sync: false` dashboard-editable env var defaulting to wildcard, so CORS can be tightened later without a redeploy.

2. **Should `proxy/server/` use TypeScript (build step) or plain JavaScript?**
   - What we know: D-03 locks "Node + Express," not a language. The rest of the codebase is strict TypeScript; the old (deleted) Firebase Function was also TypeScript.
   - What's unclear: Whether the user has a preference for consistency vs. the "simpler ops" philosophy that motivated the whole Render pivot.
   - Recommendation: Default to plain JavaScript (see Alternatives Considered) unless the user/planner has a strong consistency preference — a compile step is one more thing that can fail Render's build and adds no runtime benefit for a service this small.
   - **RESOLVED:** Planner adopted the recommendation. 05-01 implements `proxy/server/` in plain JavaScript (`server.js`, `session.js`, `session.test.js`) — no TypeScript build step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Local dev, smoke test execution | ✓ | v24.15.0 (dev machine) | Render service itself should pin `NODE_VERSION` independently (see Pitfall 4) — dev machine version is not authoritative for the deployed service |
| npm | `npm install` for the new proxy package | ✓ | 11.12.1 | — |
| git | Committing `render.yaml`, deleting Firebase artifacts | ✓ | 2.45.2 | — |
| curl | Optional — alternative smoke-test implementation | ✓ | 8.8.0 (Windows/Schannel build) | Node-based smoke test recommended instead (D-09 discretion) for cross-platform reliability on this Windows dev machine |
| Render CLI | Not required — Blueprint deploy is git-push-driven, no CLI needed | ✗ (not installed) | — | Not needed; Render's Blueprint sync is triggered by dashboard connection + git push, no local CLI dependency |
| Render account + GitHub connection | Blueprint deploy (D-04/D-05) | Account exists; GitHub repo connection does **not** exist yet | — | None — this step requires a human browser action (OAuth flow); cannot be automated by an executor agent. Plan must include a `checkpoint:human-verify`-style task here. |

**Missing dependencies with no fallback:**
- GitHub-repo-to-Render connection (D-05) — browser-only OAuth flow, no CLI/API equivalent for the *initial* connection. Must be a human-in-the-loop step in the plan.

**Missing dependencies with fallback:**
- Render CLI — not installed, not needed (Blueprint sync is git-driven).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 |
| Config file | `vitest.config.ts` (repo root) — currently `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']`, does **not** cover a new `proxy/server/` directory |
| Quick run command | `npx vitest run <path-to-file>` |
| Full suite command | `npm test` (→ `vitest run`) |

### Phase Requirements → Test Map

This phase has no numbered `REQ-ID`s (infra/deploy phase, `phase_req_ids: null`). Mapping instead to the phase's 6 Success Criteria from ROADMAP.md:

| SC # | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|-------------|
| SC-1 | Render Web Service deployed via `render.yaml`; URL live | smoke/manual | `curl -f https://<render-url>/healthz` | ❌ Wave 0 (`healthCheckPath` route) |
| SC-2 | Proxy relays all 3 BGG cookies correctly on authenticated write | smoke (part of full smoke test) | `node scripts/smoke-test-render.mjs` | ❌ Wave 0 |
| SC-3 | `.env.production` has the live Render URL | trivial/manual | `grep VITE_BGG_API_BASE .env.production` | — (single-line edit, no dedicated test needed) |
| SC-4 | Automated real-credential smoke test exits 0 | smoke | `node scripts/smoke-test-render.mjs` | ❌ Wave 0 |
| SC-5 | `npm run build` succeeds; no CORS errors reaching BGG through the proxy | build + manual browser check | `npm run build && npm run preview` (then manual DevTools Network tab check) | — (existing build pipeline; no new automated CORS-in-browser test planned) |
| SC-6 | Firebase artifacts removed | trivial/manual | `test ! -e proxy/functions && test ! -e firebase.json && test ! -e .firebaserc` | — (file-existence check, no dedicated test file) |

**Optional but recommended:** if `proxy/server/server.js`'s cookie-extraction logic is factored into small pure functions (e.g. `extractSessionId(setCookieHeaders)`, `sanitizeSessionToken(raw)`), these can be unit-tested with Vitest the same way `rankingEngine.ts` is — network-free, deterministic. This requires expanding `vitest.config.ts`'s `include` glob to also match `proxy/**/*.test.ts` (or `.js`), since it currently only scans `src/`.

### Sampling Rate
- **Per task commit:** `npx vitest run` on any new unit test file for extracted proxy logic (if applicable)
- **Per wave merge:** `npm test` (full suite) + `node scripts/smoke-test-render.mjs` once the Render service is live
- **Phase gate:** Full Vitest suite green AND smoke test exits 0 against the live Render URL before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `proxy/server/server.js` (or `.ts`) — does not exist yet; core deliverable of this phase
- [ ] `proxy/server/package.json` — new package, own `express`/`cors` deps
- [ ] `render.yaml` — repo root, does not exist yet
- [ ] `scripts/smoke-test-render.mjs` — does not exist yet (confirmed: no `scripts/` directory in repo at all)
- [ ] `vitest.config.ts` `include` glob — needs extending to `proxy/**/*.test.ts` **only if** unit tests are added for extracted cookie-parsing pure functions; otherwise no change needed
- [ ] `/healthz` route in the Express app — needed for `render.yaml`'s `healthCheckPath` and for SC-1's live-URL verification

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes (indirectly) | BGG credential handling is unchanged — proxy never stores username/password, only forwards them in the login request body and relays session cookies. No new auth surface introduced. |
| V3 Session Management | Yes | Server-side `proxySession` module-scoped cache is itself a session-storage mechanism (see Pattern 1). Single-process, single-tenant-in-practice risk profile is acceptable for this personal-use app but should be documented, not silently assumed. |
| V4 Access Control | No | No user roles/permissions in this service — it is a pure relay. |
| V5 Input Validation | Yes | `X-BGG-Session` header value must be sanitized against `^[A-Za-z0-9_-]+$` before being interpolated into the outbound `Cookie:` header (carry forward from `vite.config.ts`'s existing CR-02 guard) — prevents CRLF/header injection. |
| V6 Cryptography | No | TLS termination is handled by Render's platform and BGG's own HTTPS endpoint; no application-level cryptography is introduced by this phase. |

### Known Threat Patterns for Express reverse proxy

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| CRLF/header injection via unsanitized `X-BGG-Session` header value | Tampering | Regex-validate the header value (`[A-Za-z0-9_-]+`) before using it to construct the `Cookie:` header — already proven in `vite.config.ts`, carry forward verbatim |
| SSRF via client-controlled upstream host | Elevation of Privilege / Tampering | Hardcode `boardgamegeek.com` as the upstream host in server code — never derive the host from client-supplied input. The existing pattern (both `vite.config.ts` and the old Firebase Function) already does this correctly; do not introduce a configurable/dynamic upstream host. |
| Open-relay abuse via wildcard CORS (`ALLOWED_ORIGIN: "*"`) | Spoofing (of origin) | Accepted risk for this phase (see Assumption A3) — any web page could route BGG API calls through this proxy, but cannot obtain a valid BGG session without real BGG credentials, limiting the practical impact. Lock to a specific origin once a permanent SPA hosting URL exists (`sync: false` env var makes this a dashboard-only change, no redeploy needed). |
| `Set-Cookie` leaking to the browser, exposing `bggusername`/`bggpassword` to client JS | Information Disclosure | Never relay raw `Set-Cookie` headers on the `/login` response path — synthesize and return only `{sessionId}` JSON, exactly as `vite.config.ts` and the old Firebase Function both already do. Carry forward unchanged (D-08). |

## Sources

### Primary (HIGH confidence)
- This repository's own `vite.config.ts` (lines ~11-90) — proven-working BGG cookie relay, read directly via the Read tool `[VERIFIED: codebase]`
- This repository's own `src/api/bggClient.ts` — actual current client contract (login/collection/rate endpoints, headers, bodies) `[VERIFIED: codebase]`
- `gsd-tools query package-legitimacy check --ecosystem npm express cors` — both `OK` `[VERIFIED: npm registry]`
- `npm view express version` / `npm view cors version` — 5.2.1 / 2.8.6, run directly `[VERIFIED: npm registry]`

### Secondary (MEDIUM confidence)
- [Blueprint YAML Reference – Render Docs](https://render.com/docs/blueprint-spec) — `render.yaml` schema, fields, plan values, envVars mechanics
- [render-oss/skills render-blueprints SKILL.md](https://github.com/render-oss/skills/blob/main/skills/render-blueprints/SKILL.md) — official Render org example Blueprint, immutable-field warnings
- [Connect GitHub – Render Docs](https://render.com/docs/github) — GitHub connection is browser/OAuth-only, no CLI equivalent for first connection
- [Setting Your Node.js Version – Render Docs](https://render.com/docs/node-version) — `NODE_VERSION` env var / `.node-version` / `engines` field options
- [Headers: getSetCookie() method - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Headers/getSetCookie) — fetch API multi-cookie handling
- [Vite env-and-mode guide](https://vite.dev/guide/env-and-mode.html) — `.env.production` build-time static replacement behavior

### Tertiary (LOW confidence)
- Render free-tier spin-down/cold-start timing (15 min inactivity, ~30-60s cold start) — WebSearch-aggregated from multiple third-party blog posts and a GitHub community discussion, not a single authoritative doc page; directionally reliable but exact timing figures should be treated as approximate
- [Render community forum: "doesn't respect engines setting"](https://community.render.com/t/render-doesnt-respect-engines-setting-in-package-json-as-the-docs-suggest/2805) — community-reported, not confirmed in official docs; treated as a corroborating signal only, mitigated cheaply regardless (explicit `NODE_VERSION` costs nothing)
- General "Express + cors + reverse proxy + cookies" WebSearch results — used mainly to confirm that this project's existing header-based (not cookie-based) SPA↔proxy contract sidesteps the classic cross-origin-cookie CORS limitation, corroborating rather than introducing new architecture

## Metadata

**Confidence breakdown:**
- Standard stack (express/cors): HIGH — verified directly against npm registry, both flagged OK by the legitimacy seam
- Render Blueprint mechanics: MEDIUM — CITED from official Render docs and the official render-oss skills repo, cross-checked across two independent official sources
- Cookie-relay architecture (Pattern 1): HIGH — VERIFIED by direct reading of this repo's own proven-working `vite.config.ts` code, not external research
- Render free-tier cold-start timing: LOW — WebSearch-aggregated, no single authoritative source with exact numbers; directionally correct, treat specific seconds/minutes as approximate
- Security domain: MEDIUM — threat patterns follow directly from the verified architecture; mitigations largely carry forward from already-proven code

**Research date:** 2026-07-17
**Valid until:** 30 days for Render platform mechanics (stable IaC product, low churn); the codebase-derived architecture findings (Pattern 1, cookie handling) do not expire — they are structural facts about this specific application, not time-sensitive platform behavior.
