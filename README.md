<!-- generated-by: gsd-doc-writer -->
# BGG Ranker

A browser SPA that helps [BoardGameGeek](https://boardgamegeek.com) users rank their board game collection through head-to-head comparisons. Maintains a bell-curve distribution across tiers 1–10 with decimal precision and syncs ratings back to BGG.

## Features

- **Head-to-head comparisons** — pick a winner between two games to build your ranked list
- **Bell-curve tier distribution** — games are automatically distributed across 10 tiers
- **BGG sync** — write your ratings directly back to your BGG account
- **Offline-first** — rankings persist in localStorage; no backend required
- **Collection reconciliation** — new/removed games are merged on return visits
- **Unplayed tracking** — flag games as unplayed to exclude them from comparisons without deleting them

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
| Firebase Cloud Functions | Production CORS proxy |

## Installation

```bash
npm install
```

## Quick Start

```bash
npm run dev
```

The app runs at `http://localhost:5173`. The Vite dev server proxies `/bggapi/*` to `boardgamegeek.com`, handling CORS automatically.

Open the app, enter your BGG username, and the app will load your board game collection. Use head-to-head comparisons to build your ranked list, then sync ratings back to BGG when done.

## Usage

### App views

The app moves through a sequence of views as you work:

1. **Username entry** — enter your BGG username (and password if syncing ratings)
2. **Collection loading** — fetches and parses your BGG collection (handles 202 queued responses automatically)
3. **Comparison** — head-to-head match-ups to rank games against each other
4. **Ranked list** — view your full ranked collection sorted by tier and rating
5. **Syncing** — batch writes your ratings back to BGG

### Development session setup

BGG requires an authenticated session for write operations. In development, the Vite proxy handles cookies. Create a `.env.local` file (never committed) with your BGG dev session cookies if needed:

```
BGG_DEV_SESSION=SessionID=<value>; bggusername=<value>; bggpassword=<value>
```

Restart `npm run dev` after creating this file. BGG session cookies expire — repeat the process if you see 401 errors.

## Architecture Notes

- **Integer-internal ratings** — all ratings are stored as integers (`801` = 8.01) to avoid IEEE 754 float errors. Values are divided by 100 only at display and BGG sync time.
- **990-game ceiling** — 99 unique decimal values per tier × 10 tiers. The app validates capacity before every initialization.
- **Credentials never persisted** — username/password live in Zustand session state only, never written to localStorage.
- **202 polling** — BGG collection requests may return HTTP 202 (queued). The client retries up to 8 times with a 3-second delay before accepting results.

## Production Deployment

The production CORS proxy is a Firebase Cloud Function in `proxy/functions/`. See `proxy/README.md` for full deployment instructions.

After deploying the Firebase Function, set `VITE_BGG_API_BASE` in `.env.production`:

```
VITE_BGG_API_BASE=https://us-central1-<YOUR_PROJECT_ID>.cloudfunctions.net/bgg
```

The Firebase project must be on the **Blaze (pay-as-you-go)** plan — the free Spark tier blocks outbound HTTP to external services.

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with BGG proxy at `http://localhost:5173` |
| `npm run build` | Type-check and build production bundle to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |
