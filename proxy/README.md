# BGG Proxy — Render Web Service

This directory contains the Node + Express reverse proxy that acts as the production CORS
proxy for the BGG API. It adds CORS headers and relays BGG's 3-cookie session so the SPA can
call BGG from the browser. The proxy lives in `proxy/server/` and is deployed to Render via
the repo-root `render.yaml` Blueprint.

## Overview

BGG's API does not set permissive CORS headers, so browser clients cannot call it directly in
production. `proxy/server/server.js` is a small Express app that:

- Adds `Access-Control-Allow-Origin` (configurable via `ALLOWED_ORIGIN`)
- Mirrors every incoming request path straight through to `boardgamegeek.com` (no path
  rewriting or query-param wrapping)
- On `/login`, captures BGG's full `Set-Cookie` set server-side, caches it in-process, and
  returns only `{ "sessionId": "..." }` to the SPA
- On all other requests, replays the cached 3-cookie session (`SessionID` + `bggusername` +
  `bggpassword`) so authenticated calls (e.g. rating writes) succeed
- Exposes `GET /healthz` for Render's health check

## Production Deployment (Render)

1. Commit `render.yaml` (repo root) and `proxy/server/` — both are already tracked.
2. In the Render dashboard, connect the GitHub repo and create/sync the Blueprint. This is a
   browser-only OAuth step with no CLI equivalent — Render reads `render.yaml` and provisions
   the `bgg-ranker-proxy` free-tier Node web service automatically.
3. Once the service is live, copy its URL (e.g. `https://bgg-ranker-proxy.onrender.com`) into
   `.env.production` as:
   ```
   VITE_BGG_API_BASE=https://bgg-ranker-proxy.onrender.com
   ```
4. Rebuild the SPA (`npm run build`) so the new base URL is baked into the production bundle.

**Cold starts:** the free tier spins the service down after ~15 minutes of inactivity. The
first request after idle can take ~30-60 seconds while Render cold-starts the container. The
SPA's existing retry/poll logic (and the smoke test's `withColdStartRetry` wrapper) tolerate
this.

## Proxy Interface

The proxy mirrors BGG's real path structure directly — there is **no** query-parameter path
wrapper. Requests are made straight to `<RENDER_URL><bgg-path>`:

- Collection read: `GET <RENDER_URL>/xmlapi2/collection?username=X&own=1&subtype=boardgame`
- Login: `POST <RENDER_URL>/login/api/v1`
- Rate a game: `PUT <RENDER_URL>/api/collectionitem/{collId}` with an `X-BGG-Session` header

For authenticated write calls, the SPA sends the session token as the `X-BGG-Session` header.
The proxy reattaches the cached 3-cookie session before forwarding to BGG.

## Session Token Handling

The proxy captures BGG's full `Set-Cookie` set (SessionID + bggusername + bggpassword) from
the login response server-side and returns only `{ "sessionId": "..." }` as JSON. The SPA
stores this in Zustand `SessionState` (in-memory only, never written to localStorage —
AUTH-03).

**`Set-Cookie` is never relayed to the SPA.** This sidesteps `HttpOnly` cookie restrictions
and satisfies AUTH-03 (credentials session-only, never persisted). The 3-cookie set is what
the proxy's server-side session cache holds and replays on subsequent authenticated requests;
that cache is wiped on cold start.

## Quick Verification

Check the health endpoint:

```bash
curl -f https://bgg-ranker-proxy.onrender.com/healthz
```

Expected: HTTP 200.

Check a real collection read:

```bash
curl "https://bgg-ranker-proxy.onrender.com/xmlapi2/collection?username=boardgamegeek&own=1&subtype=boardgame" -v
```

Expected: HTTP 200 or 202 response with XML body.

Run the full smoke test (covers read, login, and an authenticated rating write):

```bash
RENDER_URL=https://bgg-ranker-proxy.onrender.com \
BGG_USERNAME=your-bgg-username \
BGG_PASSWORD=your-bgg-password \
node scripts/smoke-test-render.mjs
```
