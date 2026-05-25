# BGG Ranker

## What This Is

A browser-based web app that helps BoardGameGeek users rank their personal board game collection through repeated head-to-head comparisons. The app pulls a user's collection from the BGG XML API, lets them pick winners in random two-game matchups, and maintains a precise bell-curve ranking across a 1–10 scale. Rankings sync back to BGG as star ratings.

## Core Value

The user can always tell which of any two games they actually prefer, and the ranking list accurately reflects that — not BGG's community scores, not gut-feel star ratings.

## Current State (v0.9 — 2026-05-25)

**Shipped:** Core ranking and sync loop complete. Users can load BGG collections, rank games through head-to-head comparisons, and sync ratings back to BGG. Persistence, drag-and-drop reordering, unplayed game management, dirty-game tracking, and 401 re-auth all work.

**Remaining for v1.0:**
- Phase 4: Display polish (DISP-01 thumbnails, DISP-02 upset callouts)
- Phase 5: Firebase Cloud Function production deploy

**Tech stack locked:** React 19 + Vite 6 + TypeScript + Zustand + TanStack Query + Tailwind 4 + Vitest

## Requirements

### Validated (v0.9)

- ✅ AUTH-01, AUTH-02, AUTH-03 — BGG auth, unsynced-changes guard, 401 re-auth
- ✅ COLL-01, COLL-03 — Collection fetch (owned + previously-rated)
- ✅ RANK-01 through RANK-10 — Full ranking engine, bell-curve, integer storage
- ✅ REFRESH-01 — Manual redistribution
- ✅ SYNC-01, SYNC-02, SYNC-03 — Batch sync with dirty tracking, throttle, resume
- ✅ PERSIST-01, PERSIST-02 — localStorage persistence with username guard

### Pending

**Display (Phase 4)**
- [ ] DISP-01: BGG thumbnail (cover art) shown during head-to-head comparison picks
- [ ] DISP-02: Upset callout shown after picking a winner that was ranked significantly lower

### Out of Scope

- Server-side storage or backend — localStorage only; no account system beyond BGG
- Multi-user support — one BGG user per browser instance
- Mobile app or desktop wrapper — browser only
- Real-time sync after every comparison — sync is batch/on-demand only

## Context

BGG XML API2 documentation: https://boardgamegeek.com/wiki/page/BGG_XML_API2

The API provides public read access to collections. Write operations (rating a game) require an authenticated BGG session obtained by POSTing credentials to BGG's login endpoint, which returns a session cookie used for subsequent write calls.

**CORS note:** BGG's API does not set permissive CORS headers. Browser-direct requests to the BGG API will likely be blocked. The app will need either a lightweight proxy (e.g. a minimal Express/Node server or Vite dev-proxy), a CORS-anywhere pattern, or to proxy through a serverless function. This is a known integration hurdle that must be resolved in Phase 1.

**Percentage normalization:** The requested tier weights (2+6+12+18+24+30+10+5+3+3 = 113%) do not sum to 100%. The engine must normalize these proportionally before computing how many games belong in each tier for a given collection size.

## Constraints

- **Tech stack**: Browser web app — framework TBD during planning
- **Auth**: BGG username/password, session-only; BGG does not offer OAuth
- **CORS**: BGG API requires a proxy layer for browser clients — must be addressed before collection fetch can work
- **Decimal precision**: 2 decimal places; tier N holds at most 99 unique values (N.00 to (N-1).01)
- **Collection size**: Spacing math must work for any realistic collection size (10–2000 games)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app (browser) | Lowest barrier — no install, works anywhere | ✅ Validated |
| localStorage for rankings | No backend needed; acceptable data-loss risk for personal use | ✅ Validated |
| Session-only credentials | Avoid storing BGG passwords locally; user re-enters each session | ✅ Validated (AUTH-03) |
| Random initial seed | Neutral starting point; no bias from BGG community scores | ✅ Validated |
| Always-swap on upset | Chosen game always takes loser's position when it was ranked lower | ✅ Validated |
| Sync is on-demand | Avoid API rate limits; user controls when BGG sees changes | ✅ Validated |
| Firebase Cloud Functions (Blaze) | User has existing Firebase project; replaces Cloudflare Worker plan | Deploy deferred to Phase 5 |
| Integer-internal rating storage (801 = 8.01) | Eliminate IEEE 754 float precision errors | ✅ Validated — no collisions across all tested sizes |
| dirtyGameIds replaces syncedGameIds | Precise per-game dirty tracking; only changed games re-sync | ✅ Implemented Phase 3.1 |
| X-BGG-Session header + regex sanitization | Dev server restart resilience; prevents cookie injection | ✅ Implemented Phase 3.1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-25 after v0.9 milestone close*
