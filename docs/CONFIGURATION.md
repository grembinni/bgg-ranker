<!-- generated-by: gsd-doc-writer -->
# Configuration

This document covers all environment variables, per-environment overrides, and runtime configuration for BGG Ranker.

---

## Environment Variables

BGG Ranker uses Vite's built-in environment variable system. Variables prefixed with `VITE_` are bundled into the client build and accessible via `import.meta.env`. Variables without the prefix are only available in `vite.config.ts` at build/dev-server time.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_BGG_API_BASE` | Required | — | Base path prefix for all BGG API requests. Set to `/bggapi` in development (routed through the Vite proxy) and left empty in production (Cloudflare Worker handles routing). |
| `BGG_DEV_SESSION` | Optional | `""` | Pre-seeded BGG session cookie string for the Vite dev proxy. Useful when the dev server is restarted after login and `proxySession` in memory has been cleared. Injected as the `Cookie` header on proxied requests when no in-memory session exists. Not bundled into the client build. |

**Startup warning:** In development mode, if `VITE_BGG_API_BASE` is not set, `bggClient.ts` logs a console warning: `[bggClient] VITE_BGG_API_BASE is not set — all API calls will fail`.

---

## Per-Environment Files

Vite loads environment files in this order (later files take precedence):

| File | Committed | Purpose |
|---|---|---|
| `.env` | No (gitignored) | Shared baseline — sets `VITE_BGG_API_BASE=/bggapi` |
| `.env.development` | Yes | Development overrides — also sets `VITE_BGG_API_BASE=/bggapi` |
| `.env.production` | Yes | Production overrides — sets `VITE_BGG_API_BASE=` (empty, no proxy prefix needed) |
| `.env.local` | No (gitignored) | Local developer overrides — use this for `BGG_DEV_SESSION` |
| `.env.*.local` | No (gitignored) | Mode-specific local overrides |

`.env.local` and `.env.*.local` are gitignored. Never commit session cookies or credentials to any tracked file.

### Development (`npm run dev`)

Vite proxies all requests matching `/bggapi/*` to `https://boardgamegeek.com`, stripping the `/bggapi` prefix before forwarding. This works around the BGG API's lack of CORS headers.

```bash
VITE_BGG_API_BASE=/bggapi
```

The proxy in `vite.config.ts` also handles:
- **Login interception**: Extracts `sessionid` from BGG's `Set-Cookie` response and returns `{ sessionId: "..." }` as JSON.
- **Cookie injection**: Stores session cookies in memory and forwards them on subsequent authenticated requests.
- **Cookie rewriting**: Strips `Secure` flag and rewrites `domain` to `localhost` so cookies work in the browser during development.

To persist a session across dev server restarts, set `BGG_DEV_SESSION` in `.env.local`:

```bash
# .env.local
BGG_DEV_SESSION=SessionID=abc123; bggusername=youruser; bggpassword=hashed
```

### Production (built with `npm run build`)

```bash
VITE_BGG_API_BASE=
```

`VITE_BGG_API_BASE` is empty. A Cloudflare Worker sits in front of the app and proxies BGG API requests, providing the same CORS workaround as the Vite dev proxy.
<!-- VERIFY: Confirm the Cloudflare Worker deployment URL and routing configuration -->

---

## localStorage Configuration

Persisted application state is stored in the browser's `localStorage` under a versioned key:

```
bgg-ranker:v1:collection-and-rankings
```

The `:v1:` segment is a schema version. If the data format changes in a future release, incrementing this version prevents stale schema corruption — old data under the previous key is simply ignored.

**Persisted state includes:**

| Field | Type | Description |
|---|---|---|
| `games` | `Record<string, Game>` | Game metadata (name, thumbnail, year) keyed by BGG objectid |
| `lastFetched` | `number \| null` | Unix timestamp (ms) of the last successful collection fetch |
| `ratings` | `Record<string, number>` | Integer-internal ratings (e.g., `801` = 8.01) keyed by BGG objectid |
| `comparisonsTotal` | `number` | Lifetime comparison count |
| `rankingsUsername` | `string \| null` | BGG username whose rankings are stored — used to detect user switches |
| `version` | `number` | Schema version (currently `1`) |
| `dirtyGameIds` | `string[]` | Game IDs with ratings not yet synced to BGG |
| `comparisonsAtLastSync` | `number` | `comparisonsTotal` value at the time of the last successful sync |
| `unplayedIds` | `string[]` | Game IDs marked as not yet played (excluded from ranked comparisons) |

**Never persisted (session-only):**

| Field | Reason |
|---|---|
| `sessionUsername` | AUTH-03: credentials must not survive a page reload |
| `sessionId` | AUTH-03: BGG session token must not be persisted to localStorage |

If `rankingsUsername` in localStorage does not match the username entered at the entry screen, all stored rankings are discarded before fetching a new collection.

---

## Ranking Engine Limits

The ranking engine enforces a hard ceiling:

| Parameter | Value | Source |
|---|---|---|
| Maximum games | 990 | 99 unique integer rating values × 10 tiers |
| Rating precision | Integer-internal (÷ 100 at display/sync time) | e.g., `801` is displayed and synced as `8.01` |
| Tiers | 1–10 | Tier N covers integers `[N×100, (N-1)×100+1]` |

If a collection exceeds 990 games, `validateTierCapacity()` throws a `TierCapacityError` and the UI shows an error before any state is mutated.

---

## BGG API Retry Configuration

These values are constants in `src/api/bggClient.ts` and are not configurable via environment variables:

| Parameter | Value | Description |
|---|---|---|
| `MAX_RETRIES` | `8` | Maximum number of retries on HTTP 202 responses |
| `RETRY_DELAY_MS` | `3000` ms | Delay between retries when BGG returns 202 (queue not ready) |

BGG's collection endpoint may return HTTP 202 on the first request while it prepares the data. The client polls until the data is ready or `MAX_RETRIES` is exhausted.

---

## BGG Write Throttle

When syncing ratings back to BGG, the store introduces a 1-second delay between successive write requests to avoid rate-limiting. This value is hardcoded in `src/store/store.ts` (`delay(1000)`).

<!-- VERIFY: Confirm whether the Cloudflare Worker imposes additional rate-limiting on BGG write requests -->
