# BGG Ranker

A browser SPA that helps [BoardGameGeek](https://boardgamegeek.com) users rank their board game collection through head-to-head comparisons. Maintains a bell-curve distribution across tiers 1–10 with decimal precision and syncs ratings back to BGG.

## Features

- **Head-to-head comparisons** — pick a winner between two games to build your ranked list
- **Bell-curve tier distribution** — games are automatically distributed across 10 tiers
- **BGG sync** — write your ratings directly back to your BGG account
- **Offline-first** — rankings persist in localStorage; no backend required
- **Collection reconciliation** — new/removed games are merged on return visits

## Tech Stack

| Technology | Role |
|------------|------|
| React 19 + TypeScript | UI |
| Vite 6 | Build tool + dev CORS proxy |
| Zustand | App state + localStorage persistence |
| TanStack Query | BGG API fetching with 202-polling |
| fast-xml-parser | BGG XML parsing |
| Tailwind CSS 4 | Styling |
| Vitest | Unit tests for the ranking engine |
| Cloudflare Worker | Production CORS proxy |

## Getting Started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`. The Vite dev server proxies `/bggapi/*` to `boardgamegeek.com`, handling CORS automatically.

### Local BGG session workaround

BGG requires an authenticated session for collection requests. In development, inject your browser session cookies via a `.env.local` file (never committed — already in `.gitignore`):

1. Open Chrome DevTools on `boardgamegeek.com` → Application → Cookies
2. Copy the values for `SessionID`, `bggusername`, and `bggpassword`
3. Create `.env.local` in the project root:

```
BGG_DEV_SESSION=SessionID=<value>; bggusername=<value>; bggpassword=<value>
```

4. Restart `npm run dev` — the proxy will forward these cookies on every BGG API request.

> Note: BGG session cookies expire. If you start getting 401 errors again, repeat the steps above with fresh cookie values.

## Architecture Notes

- **Integer-internal ratings** — all ratings are stored as integers (`801` = 8.01) to avoid IEEE 754 float errors. Values are divided by 100 only at display and BGG sync time.
- **990-game ceiling** — 99 unique decimal values per tier × 10 tiers. The app validates capacity before every initialization.
- **Credentials never persisted** — username/password live in Zustand session state only, never written to localStorage.
- **202 polling** — BGG collection requests may return HTTP 202 (queued). The client polls with retries before accepting results.

## Production Deployment

Set `VITE_BGG_API_BASE` to your Cloudflare Worker URL. The worker must relay cookies for BGG session authentication to work.

```
VITE_BGG_API_BASE=https://your-worker.workers.dev
```

## Development Roadmap

| Phase | Description |
|-------|-------------|
| 1 — Foundation | Vite proxy, Cloudflare Worker, ranking engine, BGG client |
| 2 — Core Loop | Auth, bell-curve seeding, comparison UI, ranked list view |
| 3 — Sync & Polish | BGG batch sync, collection reconciliation, error handling |
| 4 — Production | Deployment, edge cases, final polish |

## Planned Features

- **Mark as unplayed** — small button on each game card to flag a game as unplayed and remove it from the active ranking list; unplayed games are excluded from comparisons without being deleted from the collection
