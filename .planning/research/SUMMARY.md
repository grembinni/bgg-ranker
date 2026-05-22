# Research Summary — BGG Ranker

**Synthesized:** 2026-05-22
**Overall confidence:** MEDIUM-HIGH

---

## Executive Summary

BGG Ranker is a pure browser SPA with no backend — all persistence is localStorage, all compute runs in the client, and the only external dependency is the BGG XML API2 accessed via a mandatory CORS proxy. The core innovation is a forced bell-curve tier distribution: games are assigned decimal ratings from 1.00–10.00 such that fixed percentages fall in each of 10 tiers. This has a hard constraint: 2-decimal precision caps each tier at 99 slots, making 990 games the practical ceiling. The ranking engine must be built as a pure TypeScript module fully unit-tested before any UI work touches it.

The biggest recurring risk is the BGG API: no CORS headers, a 202-queued collection endpoint that must be polled, an undocumented write endpoint for ratings, session cookies that die on tab close, and unofficial rate limits on bulk writes. All of these must be validated empirically in Phase 1 — not deferred.

---

## Recommended Stack

| Technology | Version | Role |
|------------|---------|------|
| React | 19.x | UI component tree |
| TypeScript | 5.4+ | Type safety — critical for bell-curve math invariants |
| Vite | 6.x | Build tool + dev proxy (eliminates CORS in dev, zero extra deps) |
| Zustand | 5.x | App state + `persist` middleware for localStorage |
| TanStack Query | 5.x | BGG API fetching, retry, 202-polling pattern |
| fast-xml-parser | 4.x | BGG XML to typed JS objects |
| Tailwind CSS | 4.x | Utility styling — card comparison layout is four flex lines |
| Vitest | 2.x | Unit tests for ranking engine (deterministic math) |
| Cloudflare Worker | free tier | Production CORS proxy — always warm, relays cookies |

**Bootstrap:**
```bash
npm create vite@latest bgg-ranker -- --template react-ts
npm install zustand @tanstack/react-query fast-xml-parser
npm install tailwindcss @tailwindcss/vite
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**CORS proxy pattern:**
```
Dev:  VITE_BGG_API_BASE=/bggapi          → Vite server.proxy rewrites to boardgamegeek.com
Prod: VITE_BGG_API_BASE=https://bgg-proxy.example.workers.dev
```

---

## Table Stakes — Must Ship in v1

These form an atomic unit; none works without all the others:

| Feature | Complexity | Key Constraint |
|---------|------------|----------------|
| BGG login (session-only) | Low | Credentials in-memory only; never persisted |
| Collection fetch with 202 polling | Med | Poll until 200; never write to localStorage on 0-game result |
| Bell-curve seeding (first load only) | High | Integer-internal math; 990-game hard ceiling; validate capacity before init |
| Comparison UI — pick a winner | Low | Instant visual feedback; large tap targets |
| Position-swap ranking engine | Med | `applyUpset()` is O(k); `redistribute()` only on explicit Refresh |
| Ranked list view with tier groupings | Low-Med | Decimal rating visible; games grouped by tier |
| localStorage persist + reload reconciliation | Med | Merge new/removed games on return; discard if username mismatch |
| Manual BGG sync with progress indicator | Med | 200–500ms/write throttle; diff against `lastSyncedRatings`; resume on reload |
| Unsynced-changes warning on tab close | Low | `beforeunload` guard if comparisons made since last sync |
| Error feedback for all API failures | Low-Med | Human-readable; never silent-fail |

**Cheap additions for v1:** Skip/defer comparison button, comparison count display.

**Defer to v2:** Cover art, collection filtering, tier % labels, single-step undo.

---

## Critical Watch-Outs

**C1 — 202 is not success, poll or corrupt rankings**
BGG returns HTTP 202 on first collection request (queued). If treated as empty/success and written to localStorage, saved rankings are silently wiped.
Fix: explicit 202-check, retry loop (3s delay, 8 retries), never write unless `status === 200 && games.length > 0`.

**C2 — CORS proxy must relay cookies or sync breaks silently in production**
Any production proxy that strips `Set-Cookie` headers makes auth fail invisibly. Works fine in Vite dev.
Fix: deploy Cloudflare Worker in Phase 1, smoke-test full cookie round-trip (login → cookie → rating write) in deployed env before any sync logic.

**C3 — Collection re-fetch must not overwrite existing rankings**
Calling `initializeRankings()` again on re-login destroys all comparison history.
Fix: `initializeRankings()` called exactly once (no localStorage for this user). All subsequent collection syncs use a merge-not-overwrite path.

**C4 — Tier capacity overflow at >990 games**
99 unique decimal values per tier × 10 tiers = 990-game ceiling. A 30%-weight center tier on 2000 games cannot produce unique ratings.
Fix: `validateTierCapacity()` called before every init/refresh; hard error with user-visible message if exceeded.

**C5 — Float arithmetic produces non-unique ratings**
`tierMax - (index * step)` accumulates IEEE 754 error.
Fix: store ratings as integers internally (`801` = 8.01); divide by 100 only at display/sync. Unit-test all values unique and within tier bounds.

**C6 — BGG write endpoint is undocumented and fragile**
`/api/geekrating` is community-discovered, not in the official spec.
Fix: isolate behind a single `bggRateGame()` adapter; manually test one write before building batch sync.

**C7 — Bulk sync triggers throttling**
Rapid consecutive writes cause 429s or silent failures.
Fix: 200–500ms delay between writes; diff against `lastSyncedRatings` to minimize total writes; progress counter in UI.

**C8 — Do not gate rankings view on auth state**
BGG session cookie clears on browser close. If re-auth is required to see the ranked list, users lose access to their own data on every visit.
Fix: load localStorage rankings immediately on app start; gate auth prompt on write operations only.

---

## Architecture Highlights

**Strict module boundaries:**
- UI components → store only (never call `bggClient` directly)
- Store → `bggClient` + `rankingEngine`
- `rankingEngine` → pure functions, no I/O, no side effects

**Zustand persistence rules:**
- `CollectionState` + `RankingsState` → persisted
- `SessionState` (credentials) → never persisted (XSS-readable)
- `ComparisonState`, `SyncState.status` → session-only

**Integer-internal ratings:** All ratings stored as integers (`801` = 8.01). Divide by 100 only at display/sync. Eliminates all IEEE 754 issues.

**No Web Worker needed:** Redistribution of 2000 games is ~10ms — not worth the complexity.

---

## Build Order Recommendation

```
Phase 1 — Foundation (validate all external dependencies first)
  1a. Vite proxy + Cloudflare Worker
      Smoke-test: collection fetch, login cookie round-trip, one rating write
  1b. rankingEngine.ts (pure module, zero deps)
      Full unit test suite: uniqueness, tier bounds, edge sizes (1/5/10 games)
  1c. bggClient.ts — fetch + XML + 202 polling
      Validate: subtype=boardgame filter; parseerror check; 0-game guard

Phase 2 — Core Loop
  Zustand store + persist → auth → bell-curve seeding → comparison UI + ranked list

Phase 3 — Sync + Polish
  BGG batch sync → resume-sync → collection reconciliation on return visit

Phase 4 — Production
  Deployment + error handling audit + edge case coverage
```

**Parallelizable:** `rankingEngine.ts` (1b) can be developed entirely in parallel with proxy setup (1a).

---

## Open Questions — Validate in Phase 1

1. Does `POST /login/api/v1` with `{"credentials": {"username", "password"}}` still return `SessionID` as a cookie? Verify with `curl`.
2. Does BGG accept rating values below 1.0? If not, clamp tier 1 lower bound to 1.00.
3. What is the exact URL, method, and field names for the rating write endpoint?
4. What is the safe delay floor for bulk writes before throttling triggers?
5. Does the session cookie survive tab close (Max-Age vs session-scoped)?
6. Is 3s/8-retry polling correct for the 202 loop, or does BGG respond faster for small collections?
