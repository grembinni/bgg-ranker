# BGG Ranker

## What This Is

A browser-based web app that helps BoardGameGeek users rank their personal board game collection through repeated head-to-head comparisons. The app pulls a user's collection from the BGG XML API, lets them pick winners in random two-game matchups, and maintains a precise bell-curve ranking across a 1–10 scale with BGG cover art shown at every comparison. Rankings sync back to BGG as star ratings. Returning users resume their session instantly — no re-fetch on login.

## Core Value

The user can always tell which of any two games they actually prefer, and the ranking list accurately reflects that — not BGG's community scores, not gut-feel star ratings.

## Current State (v1.0 — 2026-05-26)

**Shipped:** Full feature set complete. Cover art, upset callouts, universal header (single component across all four views), grid-as-default landing, auto-resume login, and Firebase Function routing all working. App is feature-complete and ready for production deploy.

**Remaining for v1.1:**
- Phase 5: Firebase Cloud Function deploy (production CORS proxy)

**Tech stack locked:** React 19 + Vite 6 + TypeScript + Zustand + TanStack Query + Tailwind 4 + Vitest
**Test suite:** 187/187 passing

## Requirements

### Validated (v1.0)

- ✅ AUTH-01, AUTH-02, AUTH-03 — BGG auth, unsynced-changes guard, 401 re-auth
- ✅ COLL-01, COLL-03 — Collection fetch (owned + previously-rated)
- ✅ RANK-01 through RANK-10 — Full ranking engine, bell-curve, integer storage
- ✅ REFRESH-01 — Manual redistribution
- ✅ SYNC-01, SYNC-02, SYNC-03 — Batch sync with dirty tracking, 500ms throttle, resume
- ✅ PERSIST-01, PERSIST-02 — localStorage persistence + same-user auto-resume guard — v1.0
- ✅ DISP-01 — BGG thumbnail (cover art) shown during comparison — v1.0
- ✅ DISP-02 — Upset callout after picking significantly lower-ranked winner — v1.0

### Active (v1.1)

- [ ] Firebase Cloud Function deployed and production CORS proxy operational (Phase 5)

### Out of Scope

- Server-side storage or backend — localStorage only; no account system beyond BGG
- Multi-user support — one BGG user per browser instance
- Mobile app or desktop wrapper — browser only
- Real-time sync after every comparison — sync is batch/on-demand only
- Expansion toggle (COLL-02) — boardgames only in v1; defer to v2

## Context

BGG XML API2 documentation: https://boardgamegeek.com/wiki/page/BGG_XML_API2

**CORS note:** BGG's API does not set permissive CORS headers. Dev uses Vite proxy (`/bggapi/*` → `boardgamegeek.com/*`). Production uses Firebase Cloud Function (Phase 5). `VITE_BGG_API_BASE` env var switches automatically between dev proxy and production URL.

**Codebase state (v1.0):** ~1,700 src LOC (TypeScript/TSX), ~1,100 test LOC, 169 tests. React 19 + Vite 6 + Zustand + Tailwind 4 + Vitest.

**Uniqueness guarantee:** `rankingEngine` guarantees unique ratings up to 373 games with current bell-curve weights [2,6,11,15,18,18,14,9,5,2]. RANK-07 + RANK-10 conflict documented in 01-02-SUMMARY.md.

## Constraints

- **Tech stack**: React 19 + Vite 6 + TypeScript + Zustand + TanStack Query + Tailwind 4 + Vitest (locked)
- **Auth**: BGG username/password, session-only; BGG does not offer OAuth
- **CORS**: BGG API requires a proxy layer for browser clients — Vite dev proxy for development, Firebase Cloud Function for production
- **Decimal precision**: 2 decimal places; tier N holds at most 99 unique values (N.00 to (N-1).01)
- **Collection size**: Spacing math works up to 373 games with current weights; 990-game ceiling enforced

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app (browser) | Lowest barrier — no install, works anywhere | ✅ Validated |
| localStorage for rankings | No backend needed; acceptable data-loss risk for personal use | ✅ Validated |
| Session-only credentials | Avoid storing BGG passwords locally; user re-enters each session | ✅ Validated (AUTH-03) |
| Random initial seed | Neutral starting point; no bias from BGG community scores | ✅ Validated |
| Always-swap on upset | Chosen game always takes loser's position when it was ranked lower | ✅ Validated |
| Sync is on-demand | Avoid API rate limits; user controls when BGG sees changes | ✅ Validated |
| Firebase Cloud Functions (Blaze) | User has existing Firebase project; replaces Cloudflare Worker plan | ✅ Implemented (deploy pending Phase 5) |
| Integer-internal rating storage (801 = 8.01) | Eliminate IEEE 754 float precision errors | ✅ Validated — no collisions across all tested sizes |
| dirtyGameIds replaces syncedGameIds | Precise per-game dirty tracking; only changed games re-sync | ✅ Validated Phase 3.1 |
| X-BGG-Session header + regex sanitization | Dev server restart resilience; prevents cookie injection | ✅ Validated Phase 3.1 |
| lastUpset as session-only (excluded from partialize) | Upset callout is ephemeral — no value in persisting across sessions | ✅ Validated Phase 4 |
| upsetTimer at module scope | Prevents serialization to null in persist; avoids timer leaks vs React state | ✅ Validated Phase 4 |
| PERSIST-02 guard in login(), not fetchCollection() | fetchCollection() always fetches when called directly (manual refresh, new user) | ✅ Validated Phase 4 |
| Firebase Function: req.path over req.query['path'] | Client uses direct path appending, not ?path= convention — must read URL structure | ✅ Fixed v1.0 |
| Tier weights [2,6,11,15,18,18,14,9,5,2] | Tuned for better bell-curve distribution after testing | ✅ Validated Phase 4 |
| Sync throttle 500ms (halved from 1000ms) | Better UX for large collections; BGG rate-limit tolerance confirmed | ✅ Validated Phase 4 |
| Single universal Header component replaces four per-view headers | Consistent navigation, less duplicated markup, one place to change nav chrome | ✅ Validated Phase 04.1.1 |
| Grid-as-default landing view (comparison view now opt-in via header) | Users land on an overview of their full collection rather than a single matchup | ✅ Validated Phase 04.1.1 |
| 3-column CSS grid for header layout (`justify-self-start/center/end`) | True centering of the middle icon cluster regardless of sibling (hamburger/username) width, unlike flex `justify-between` | ✅ Validated Phase 04.1.1 |

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
*Last updated: 2026-07-17 after Phase 04.1.1 completion*
