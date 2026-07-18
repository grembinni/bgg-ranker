---
phase: 05-production-deploy-render
plan: 01
subsystem: infra
tags: [express, cors-proxy, node-https, render, cookie-relay, vitest, smoke-test]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: X-BGG-Session header convention, BGG proxy client contract (bggLogin/bggRateGame/fetchCollection)
provides:
  - "proxy/server/ — new Express CORS proxy replacing the never-deployed Firebase Function"
  - "Full 3-cookie BGG session relay (SessionID + bggusername + bggpassword), server-cached and unit-tested"
  - "GET /healthz endpoint for Render's health check"
  - "scripts/smoke-test-render.mjs — automated real-credential smoke test (read + login + write)"
affects: [05-02-render-deploy, 05-03-live-verification]

# Tech tracking
tech-stack:
  added: [express@5.2.1, cors@2.8.6]
  patterns:
    - "Module-scoped mutable session cache (proxySession) replays the full Set-Cookie set from BGG login on subsequent authenticated requests — ported from vite.config.ts, the only proven-working 3-cookie implementation in this codebase"
    - "Native https module (not fetch()) for the upstream BGG call, to keep multi-Set-Cookie headers as a proper array instead of a comma-merged string"
    - "Pure, unit-tested cookie-parsing helpers (session.js) separated from the Express I/O layer (server.js)"

key-files:
  created:
    - proxy/server/package.json
    - proxy/server/session.js
    - proxy/server/session.test.js
    - proxy/server/server.js
    - scripts/smoke-test-render.mjs
  modified:
    - vitest.config.ts

key-decisions:
  - "Used express.raw({ type: () => true }) as the single body parser instead of chaining express.json()+express.text() — avoids double-consuming the request stream, which would silently drop the parsed body on JSON requests like /login"
  - "Forward request bodies as raw Buffers unmodified rather than re-serializing, since the proxy only needs to relay bytes, not interpret them"

patterns-established:
  - "Pattern 1 (server-side session cache): proxySession module-scoped variable, wiped on cold start — do not add persistent storage per 05-RESEARCH.md Pitfall 2"
  - "Header allowlist on non-login responses (content-type, content-length, cache-control) — never blanket-relay upstream headers, which would leak Set-Cookie"

requirements-completed: [SC-2, SC-4]

# Metrics
duration: 7min
completed: 2026-07-18
---

# Phase 5 Plan 1: Express CORS Proxy + Smoke Test Summary

**New Node + Express reverse proxy (`proxy/server/`) that ports vite.config.ts's proven 3-cookie BGG session relay to production, plus a cold-start-tolerant Node smoke test covering collection read, login, and authenticated rating write.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-18T01:50:24Z
- **Completed:** 2026-07-18T01:57:03Z
- **Tasks:** 3 completed
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- Extracted BGG's cookie-parsing logic into pure, unit-tested functions (`sanitizeSessionToken`, `extractSessionId`, `buildSessionCookie`) mirroring `vite.config.ts` verbatim — 10/10 tests green
- Built the Express proxy server: `/healthz`, `/login` capture branch (synthesizes `{sessionId}` JSON, never relays `Set-Cookie`), and a catch-all forward that replays the full 3-cookie set via a module-scoped cache
- Verified locally: server boots, `/healthz` returns 200, and a live BGG collection request relays through correctly with the hardcoded `boardgamegeek.com` host
- Authored `scripts/smoke-test-render.mjs` — a dependency-free Node ESM script covering all three BGG interactions (read/login/write) against a live Render URL, with cold-start retry logic mirroring `poll202Loop`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the pure cookie-parsing helpers with unit tests** - `f91cc20` (test)
2. **Task 2: Build the Express proxy server (cookie relay, /healthz, login capture, catch-all forward)** - `fcbf20a` (feat)
3. **Task 3: Author the cold-start-tolerant real-credential smoke test** - `653ac5f` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `proxy/server/package.json` - ESM package (`type: module`); express/cors deps; `start`: `node server.js`
- `proxy/server/session.js` - Pure cookie-parsing helpers exported for both server.js and unit tests
- `proxy/server/session.test.js` - 10 Vitest cases covering sanitization + extraction + build behaviors from the plan's `<behavior>` block
- `proxy/server/server.js` - Express app: CORS middleware, raw-body capture, `/healthz`, login-capture branch, catch-all forward with hardcoded upstream host and header allowlist
- `scripts/smoke-test-render.mjs` - Node ESM smoke test; `withColdStartRetry` + `poll202` retry wrappers; reads `RENDER_URL`/`BGG_USERNAME`/`BGG_PASSWORD` (optional `SMOKE_COLL_ID`/`SMOKE_OBJECT_ID`)
- `vitest.config.ts` - `include` glob extended to `proxy/**/*.test.js`

## Decisions Made
- Body parsing: chose a single `express.raw({ type: () => true })` middleware over chaining `express.json()` + `express.text()` as the plan's action text suggested — the chained approach would double-consume the request stream and silently drop the parsed JSON body on `/login` requests. Forwarding raw bytes unmodified is simpler and correctly preserves the exact request the client sent, since the proxy only relays (never interprets) bodies.
- Smoke test parses `collid`/`objectid` and any existing rating directly from the collection XML via regex (no XML parser dependency, keeping the script dependency-free per D-09's "no external deps" constraint), falling back to a benign rating of `7` when the target game is unrated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced planned express.json()+express.text() body-parser chain with a single express.raw() parser**
- **Found during:** Task 2 (Express proxy server implementation)
- **Issue:** The plan's action text specified `app.use(express.json())` plus a raw/text fallback for non-JSON bodies. Implementing this literally as two chained global middlewares would cause `express.text({ type: () => true })` (which matches every content type) to re-read the request stream after `express.json()` already consumed it for JSON requests — overwriting `req.body` with an empty string and losing the parsed login credentials.
- **Fix:** Used a single `express.raw({ type: () => true, limit: '5mb' })` middleware that captures the body once as a Buffer for every request, then forwards those bytes unmodified to BGG. This achieves the same "all content types forward correctly" goal referenced in the plan without the double-consumption bug.
- **Files modified:** proxy/server/server.js
- **Verification:** Local server boot + `/healthz` 200 + live collection GET relayed successfully (200); login POST path structurally verified (JSON body forwarded as raw bytes, matching BGG's expected `Content-Type: application/json` body exactly)
- **Committed in:** fcbf20a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correctness fix — the plan's literal body-parser suggestion would have broken the `/login` path (the single most important requirement of this plan, D-07). No scope creep; same behavioral outcome (all body types forward), safer implementation.

## Issues Encountered
- `npm test` (full suite) reports 217/217 tests passing but also prints 3 pre-existing "Unhandled Rejection" warnings from `src/api/bggClient.test.ts`'s `poll202Loop` tests. Confirmed unrelated to this plan (no `src/` files touched; only `proxy/**` added and `vitest.config.ts`'s `include` glob extended). Logged to `.planning/phases/05-production-deploy-render/deferred-items.md` per the Scope Boundary rule — not fixed, out of scope.

## User Setup Required

None - no external service configuration required. (Render deployment itself, including the human-in-the-loop GitHub connection step, is scoped to plan 05-02.)

## Next Phase Readiness
- `proxy/server/` is complete and locally verified; ready for 05-02 to write `render.yaml` and deploy it to Render.
- `scripts/smoke-test-render.mjs` is ready to run live once a Render URL exists (05-03).
- No blockers. The cold-start / session-cache-reset interaction (05-RESEARCH.md Pitfall 2) is documented in `server.js` comments, not something requiring a fix in this or later 05-phase plans.

---
*Phase: 05-production-deploy-render*
*Completed: 2026-07-18*

## Self-Check: PASSED

All created files verified present on disk (proxy/server/package.json, session.js, session.test.js, server.js, scripts/smoke-test-render.mjs, vitest.config.ts, this SUMMARY.md). All 3 task commits (f91cc20, fcbf20a, 653ac5f) verified present in git log.
