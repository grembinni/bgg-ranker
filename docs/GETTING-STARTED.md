<!-- generated-by: gsd-doc-writer -->
# Getting Started

## Prerequisites

- **Node.js** — v18 or later (no version pinned; use your system Node)
- **npm** — included with Node.js
- A [BoardGameGeek](https://boardgamegeek.com) account with a game collection

## Installation

```bash
git clone <repo-url>
cd bgg-ranker
npm install
```

## First Run

```bash
npm run dev
```

The app starts at `http://localhost:5173`. The Vite dev server proxies all `/bggapi/*` requests to `boardgamegeek.com`, so no backend is required for development.

Enter your BGG username in the app — your collection loads automatically.

## Environment Files

The project ships with three environment files:

| File | Committed | Purpose |
|------|-----------|---------|
| `.env` | No (gitignored) | Shared defaults (`VITE_BGG_API_BASE=/bggapi`) |
| `.env.development` | Yes | Dev overrides (same default proxy path) |
| `.env.production` | Yes | Production shell (`VITE_BGG_API_BASE=` — set before build) |
| `.env.local` | No (gitignored) | Local secrets — `BGG_DEV_SESSION` for cookie injection |

## Common Setup Issues

**BGG returns 401 errors when loading a private collection**

BGG requires a session cookie for private collection requests. In development, inject your browser cookies via `.env.local`:

1. Open Chrome DevTools on `boardgamegeek.com` → Application → Cookies
2. Copy `SessionID`, `bggusername`, and `bggpassword` values
3. Create `.env.local` in the project root:
   ```
   BGG_DEV_SESSION=SessionID=<value>; bggusername=<value>; bggpassword=<value>
   ```
4. Restart `npm run dev`

BGG session cookies expire — repeat these steps if you start seeing 401 errors again.

**BGG collection request hangs or returns empty**

BGG's collection endpoint may return HTTP 202 on the first request (queue the job server-side). The app polls automatically with up to 8 retries at 3-second intervals. Wait ~30 seconds before concluding the request failed.

**TypeScript errors after changing files**

Run `npm run build` to type-check the full project. The `npm run dev` server uses Vite's fast transform and does not surface all TypeScript errors.

## Next Steps

- [DEVELOPMENT.md](DEVELOPMENT.md) — build commands, code style, branch conventions
- [TESTING.md](TESTING.md) — running tests and adding new ones
- [CONFIGURATION.md](CONFIGURATION.md) — full environment variable reference