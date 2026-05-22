# Feature Landscape

**Domain:** Head-to-head comparison ranking tool for personal board game collections (BGG-connected)
**Researched:** 2026-05-22
**Confidence:** MEDIUM — based on PROJECT.md analysis, domain knowledge of ELO/comparison-ranking apps, and BGG API characteristics

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| BGG username login | Entry point to the app — without it nothing works | Low | POST to BGG login endpoint; session cookie only; no OAuth available |
| Collection fetch on login | Users expect their games to appear automatically | Low-Med | BGG XML API2 `/collection` endpoint; requires CORS proxy; large collections may need polling (BGG returns 202 on first request) |
| Two-game comparison UI | The core interaction — must be obvious and frictionless | Low | Large tap/click targets; game name prominent; cover art helps but is secondary |
| Preference pick registers immediately | Any lag or ambiguity here destroys the experience | Low | Instant visual feedback; optimistic update |
| Ranked list view | Users need to see the output of their work at a glance | Low-Med | Ordered list with tier groupings; decimal rating visible; game name |
| Bell-curve tier distribution | The defining constraint of this app's ranking model | High | Normalizing weights (2/6/12/18/24/30/10/5/3/3 → 100%); unique decimal per game; spacing math for any collection size 10–2000 |
| Persist rankings across page reload | Without this, every reload destroys work — users will not return | Low | localStorage; load on startup; overwrite on change |
| Manual sync to BGG ratings | The payoff: rankings become BGG star ratings the user can see elsewhere | Med | Requires authenticated session; one API call per game; batch sync on demand |
| Session-only credential handling | Users will not trust an app that stores their BGG password | Low | Credentials in memory only; warn user on refresh/close if unsynced changes exist |
| Error feedback on API failure | BGG API is unreliable (timeouts, 202 async, rate limits) | Low-Med | Show human-readable errors; do not silently fail on collection fetch or sync |

---

## Differentiators

Features that set this product apart. Not universally expected, but highly valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Bell-curve tier model (not ELO) | Most comparison rankers use pure ELO or simple sort; a forced bell curve means the list is always well-distributed and meaningful | High | This IS the core innovation; every tier always has the right proportion of games |
| Tier visualization on the ranked list | Seeing games grouped by tier (not one flat list) makes output actionable | Med | Color banding or section headers per tier; show count and % per tier |
| Refresh / rebalance operation | ELO accumulates noise; explicit rebalance keeps distribution honest after collection grows or shrinks | Med | REFRESH-01 in PROJECT.md; respaces all rankings while preserving relative order |
| Game cover art in comparison UI | Visual cues dramatically reduce cognitive load in head-to-head picks | Med | BGG XML returns thumbnail URLs; lazy-load for large collections |
| Comparison count / progress indicator | Users want to know how much work they have done; reduces abandonment | Low | Show total comparisons made |
| Upset highlight | When a lower-ranked game beats a higher-ranked one, surfacing that builds trust | Low | Post-pick callout: "Moved up 12 spots" |
| Skip / defer comparison | Sometimes the user cannot decide; forcing a choice creates bad data | Low | "Skip this pair" button; re-queues pair later |
| Collection filtering before ranking | Large collections (200+ games) need filtering by ownership status, play count, or "want to rank" flag | Med | BGG collection XML includes own/prevowned/wanttoplay flags |

---

## Anti-Features (Do NOT build for v1)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-sync after every comparison | BGG rate limits will trigger throttling or bans on large collections | Batch sync on user request (SYNC-02) |
| Server-side storage / user accounts | Adds auth, backend, hosting, maintenance burden | localStorage is the right tradeoff for v1 |
| Multi-user support | Data model complexity; localStorage is per-browser by nature | Single BGG user per browser instance |
| ELO score algorithm | ELO requires many matches to stabilize; this app's value is the bell-curve model | Use position-swap ranking model (RANK-03) |
| "Optimal pair selection" | Removes serendipity from the comparison loop | Random pair selection (RANK-02) |
| Export to CSV / spreadsheet | BGG sync IS the export mechanism | Sync-to-BGG is the output |
| Social / sharing features | Adds scope, backend, privacy surface | Defer indefinitely |
| Mobile app / PWA install prompt | Adds packaging complexity | Works as a web page |
| Game detail pages / BGG data display | The app is a ranker, not a game browser | Show game name and cover art only during comparison |

---

## Feature Dependencies

```
BGG Login (AUTH-01)
  └── Collection Fetch (AUTH-02)
        └── Initial Bell-Curve Seed (RANK-01)
              └── Comparison UI (RANK-02)
                    └── Ranking Engine / Position Swap (RANK-03)
                          └── Ranked List View
                                └── Refresh / Rebalance (REFRESH-01)
                                      └── BGG Sync (SYNC-01)

localStorage Persist (PERSIST-01)
  └── Load Rankings on Return (PERSIST-02)
        └── (must reconcile with current BGG collection on load)
```

**Critical reconciliation case:** On return visit, localStorage rankings may differ from the current BGG collection (games added, traded away). New games need positions seeded; removed games dropped and remaining respaced. This is NOT a v2 concern — it must be designed in v1.

---

## BGG API Constraints Affecting Feature Feasibility

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| No CORS headers on BGG API | Collection fetch and sync fail from browser without proxy | Required: Vite dev proxy or lightweight Node proxy; must be solved in Phase 1 |
| Collection endpoint returns 202 on first request | Fetch must poll until 200; UX must show loading state | Retry loop with cap (e.g. 5 retries, 2s delay) |
| BGG session via cookie (not token) | Credentials POSTed; cookie forwarded by proxy | Proxy must forward Set-Cookie and Cookie headers |
| No batch rating endpoint | Sync requires one API call per game | Throttle sync calls (e.g. 1 per 100ms); show sync progress bar |
| BGG rate limits (unofficial) | Rapid-fire requests may get throttled | Throttle + progress indicator |

---

## MVP Recommendation

**Must ship together (atomic — none works without the others):**
1. BGG login + collection fetch (with CORS proxy)
2. Bell-curve seeding on first load
3. Comparison UI with preference pick
4. Ranking engine (position-swap on upset)
5. Ranked list view with tier groupings
6. localStorage persist + load on return with collection reconciliation
7. Manual BGG sync with progress indication
8. Error handling for API failures

**Include in v1 (low-effort / high-trust):**
- Session-only credential warning on page close (if unsynced changes exist)
- Skip / defer comparison button
- Basic comparison count display

**Defer to v2:**
- Game cover art
- Collection filtering
- Tier visualization with % labels
- Single-step undo

---

## Open Questions

1. What is BGG's actual rate limit for rating updates?
2. Does BGG's rating endpoint accept values below 1.0 or above 10.0? (Tier 1 maps to 1.00; tier 10 to 10.00)
3. How does the app behave when the collection is too small for the bell curve to allocate all 10 tiers?
4. What happens to the session cookie after the user closes the tab — will they need to re-login on every visit?
