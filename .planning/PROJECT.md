# BGG Ranker

## What This Is

A browser-based web app that helps BoardGameGeek users rank their personal board game collection through repeated head-to-head comparisons. The app pulls a user's collection from the BGG XML API, lets them pick winners in random two-game matchups, and maintains a precise bell-curve ranking across a 1–10 scale. Rankings sync back to BGG as star ratings.

## Core Value

The user can always tell which of any two games they actually prefer, and the ranking list accurately reflects that — not BGG's community scores, not gut-feel star ratings.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Authentication & Collection**
- [ ] AUTH-01: User can enter BGG username and password to start a session
- [ ] AUTH-02: App fetches user's game collection from BGG XML API2 on login
- [ ] AUTH-03: Credentials are held in memory for the session only — never written to localStorage or disk

**Ranking Engine**
- [ ] RANK-01: On first load (no saved rankings), games are assigned random initial positions across the bell curve
- [ ] RANK-02: App presents two randomly selected games; user picks the one they prefer
- [ ] RANK-03: When the chosen game was ranked lower, it takes the loser's exact decimal rating; every game that was between them shifts down one spacing step
- [ ] RANK-04: Rankings follow a bell-curve tier distribution (percentages normalized from 2/6/12/18/24/30/10/5/3/3 for tiers 10–1)
- [ ] RANK-05: Each game has a unique decimal rating with 2 decimal places of precision
- [ ] RANK-06: Tier N covers the range [N.00, (N-1).01] — e.g. tier 9 = 9.00 down to 8.01
- [ ] RANK-07: Decimal values within a tier are equally spaced across the full available range (not bunched at top or bottom)
- [ ] RANK-08: No two games may share the same decimal rating at any point

**Refresh & Redistribution**
- [ ] REFRESH-01: User can trigger a refresh to respace all rankings, rebalancing tier allocations for the current collection size and normalizing spacing within each tier

**BGG Sync**
- [ ] SYNC-01: After a refresh/rerank, the app calls BGG to update each game's star rating with its new decimal value
- [ ] SYNC-02: Sync is user-initiated (not automatic after every comparison)

**Persistence**
- [ ] PERSIST-01: Current rankings are saved to localStorage so the session survives a page reload
- [ ] PERSIST-02: Stored rankings load automatically on return visits (same browser)

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
| Web app (browser) | Lowest barrier — no install, works anywhere | — Pending |
| localStorage for rankings | No backend needed; acceptable data-loss risk for personal use | — Pending |
| Session-only credentials | Avoid storing BGG passwords locally; user re-enters each session | — Pending |
| Random initial seed | Neutral starting point; no bias from BGG community scores | — Pending |
| Always-swap on upset | Chosen game always takes loser's position when it was ranked lower | — Pending |
| Sync is on-demand | Avoid API rate limits; user controls when BGG sees changes | — Pending |

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
*Last updated: 2026-05-22 after initialization*
