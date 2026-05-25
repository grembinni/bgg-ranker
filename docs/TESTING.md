<!-- generated-by: gsd-doc-writer -->
# Testing

## Test Framework and Setup

| Tool | Version | Role |
|------|---------|------|
| [Vitest](https://vitest.dev) | 4.1.7 | Test runner and assertion library |
| [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro) | 16.3.2 | React component rendering and interaction |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | 6.9.1 | DOM assertion matchers |
| jsdom | 29.1.1 | Browser environment for component tests |

**Configuration:** [`vitest.config.ts`](../vitest.config.ts)

- `.test.ts` files run in the default Node environment
- `.test.tsx` files run in jsdom (via `environmentMatchGlobs`)
- Global test APIs (`describe`, `it`, `expect`, `vi`) are available without imports
- Setup file: [`src/test-setup.ts`](../src/test-setup.ts) — imports `@testing-library/jest-dom` matchers

## Running Tests

```bash
# Run the full test suite once
npm test

# Run in watch mode (re-runs on file changes)
npx vitest

# Run a specific file
npx vitest src/engine/rankingEngine.test.ts

# Run tests matching a name pattern
npx vitest -t "RANK-06"
```

## Test Files

| File | Environment | What it covers |
|------|-------------|----------------|
| `src/engine/rankingEngine.test.ts` | node | Ranking engine: `initializeRankings`, `applyUpset`, `redistribute`, tier distribution |
| `src/api/bggClient.test.ts` | node | BGG API client: 202 polling, XML parsing, collection fetch, login |
| `src/store/store.test.ts` | node | Zustand store slices: state transitions, localStorage persistence, username mismatch eviction |
| `src/components/ComparisonView.test.tsx` | jsdom | ComparisonView: game card rendering, winner selection, keyboard interaction |
| `src/components/SyncingView.test.tsx` | jsdom | SyncingView: sync progress display, error handling |

## Writing New Tests

**Naming convention:** Place test files alongside source files using the `*.test.ts` / `*.test.tsx` suffix.

```
src/engine/rankingEngine.ts       ← source
src/engine/rankingEngine.test.ts  ← test
```

**Requirement traceability:** Test names include requirement IDs where applicable (e.g., `RANK-06`, `COLL-01`). Use this pattern for requirements-linked tests so they are greppable:

```ts
it('RANK-06: applyUpset moves winner above loser', () => { ... })
```

**Mock patterns used in the codebase:**

- In-memory `localStorage` mock — a factory that returns a fresh `Record<string, string>`-backed storage object; used in store tests to avoid real localStorage side effects.
- `vi.mock('../api/bggClient')` — stubs the BGG client module in store tests so no network calls are made.
- `vi.stubGlobal('fetch', ...)` + `vi.useFakeTimers()` — used in `bggClient.test.ts` to simulate 202 polling delays without waiting real time.

## Coverage Requirements

No coverage thresholds are configured. There is no `coverageThreshold` in `vitest.config.ts`.

## UAT Smoke Test

A Playwright-based end-to-end smoke test is available at [`scripts/uat-smoke.cjs`](../scripts/uat-smoke.cjs). It runs against a live dev server at `http://localhost:5173` and is **not** included in `npm test`.

To run it manually:

```bash
# Start the dev server first
npm run dev

# In a second terminal
node scripts/uat-smoke.cjs
```

## CI Integration

No CI pipeline is configured (no `.github/workflows/` directory). Tests run locally only.