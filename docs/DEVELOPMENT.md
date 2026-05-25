<!-- generated-by: gsd-doc-writer -->
# Development

## Local Setup

1. Clone and install dependencies:
   ```bash
   git clone <repo-url>
   cd bgg-ranker
   npm install
   ```

2. Configure your local BGG session (optional — only needed for authenticated collection reads):
   ```bash
   # .env.local (gitignored)
   BGG_DEV_SESSION=SessionID=<value>; bggusername=<value>; bggpassword=<value>
   ```
   See [GETTING-STARTED.md](GETTING-STARTED.md) for how to obtain these cookie values.

3. Start the dev server:
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:5173`. The Vite dev server proxies `/bggapi/*` to `boardgamegeek.com`.

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR and BGG API proxy |
| `npm run build` | Type-check with `tsc -b`, then produce a production bundle in `dist/` |
| `npm run preview` | Serve the `dist/` bundle locally for production smoke-testing |
| `npm run lint` | Run ESLint across the project (`eslint .`) |
| `npm test` | Run the full Vitest test suite once (`vitest run`) |

## Code Style

**TypeScript** — `tsconfig.app.json` enforces strict mode:

- `strict: true` — enables all strict type checks
- `noUnusedLocals` and `noUnusedParameters` — no dead variables
- `noFallthroughCasesInSwitch` — explicit `break`/`return` in every case
- `noUncheckedSideEffectImports` — side-effect imports must be intentional

Run `npm run build` to surface all TypeScript errors (the dev server does not block on them).

**ESLint** — `npm run lint`. No Prettier or Biome config is present; formatting is left to editor defaults.

**Project-specific conventions (from CLAUDE.md):**

- Ratings are always stored as integers (`801` = 8.01). Divide by 100 only at display or BGG sync time.
- UI components must not call `bggClient` directly — all API calls go through the Zustand store.
- Credentials (`username`/`password`) are never persisted to localStorage.

## Branch Conventions

No formal branch naming convention is documented. The `main` branch is the default and target for all merges. Suggested prefixes that match the commit convention:

| Prefix | Use |
|--------|-----|
| `feat/` | New functionality |
| `fix/` | Bug fixes |
| `chore/` | Tooling, config, dependencies |
| `docs/` | Documentation only |

## PR Process

No `.github/PULL_REQUEST_TEMPLATE.md` is present. Follow these guidelines when submitting a pull request:

- Keep each PR focused on a single concern — avoid mixing feature work with refactors.
- All new logic must have unit tests; run `npm test` before opening the PR.
- Run `npm run build` to confirm no TypeScript errors.
- Run `npm run lint` and resolve any warnings.
- Commit messages must follow the convention: `feat:`, `fix:`, `test:`, `chore:`, or `docs:` prefix with a short imperative description.
- Include a description explaining *why* the change is needed, not just what changed.
