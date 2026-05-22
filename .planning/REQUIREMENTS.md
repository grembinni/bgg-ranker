# Requirements: BGG Ranker

**Defined:** 2026-05-22
**Core Value:** The user can always tell which of any two games they actually prefer, and the ranking list accurately reflects that — not BGG's community scores, not gut-feel star ratings.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can enter BGG username and password to start a session (credentials held in memory only — never written to localStorage or disk)
- [ ] **AUTH-02**: App warns the user before tab close if any comparisons have been made since the last BGG sync (unsynced-changes guard)
- [ ] **AUTH-03**: When a BGG write call returns 401 (session expired mid-session), the app prompts the user to re-enter credentials before retrying sync

### Collection

- [ ] **COLL-01**: App fetches the user's owned board games from BGG XML API2 (excludes expansions by default)
- [ ] **COLL-02**: User can toggle to include expansions in the comparison pool
- [ ] **COLL-03**: App also fetches unowned games the user has previously rated on BGG and includes them in the pool

### Ranking Engine

- [ ] **RANK-01**: On first load with no saved rankings for this user, games are assigned random initial positions distributed across the bell-curve tiers
- [ ] **RANK-02**: App presents two randomly selected games from the pool; user picks the one they prefer
- [ ] **RANK-03**: When the chosen game was ranked lower, it takes the loser's exact decimal rating; every game between the winner and loser in ranked order shifts down one spacing step
- [ ] **RANK-04**: User can skip a comparison ("Too close to call"); the pair is re-queued for a later round
- [ ] **RANK-05**: App displays a comparison count (current session and total lifetime)
- [ ] **RANK-06**: Rankings follow a bell-curve tier distribution with weights 2/6/12/18/24/30/10/5/3/3 (normalized to 100%) for tiers 10 through 1
- [ ] **RANK-07**: Each game has a unique decimal rating with exactly 2 decimal places; no two games share a rating
- [ ] **RANK-08**: Tier N covers the range [N.00, (N-1).01] — tier 9 = 9.00 down to 8.01; tier 1 = 1.00 down to 0.01 (clamped to 1.00 if BGG rejects sub-1.0 values)
- [ ] **RANK-09**: Decimal values within a tier are equally spaced across the full available range (not clustered at top or bottom); ratings stored as integers internally (e.g. `801` = 8.01) to eliminate floating-point precision errors
- [ ] **RANK-10**: System validates tier capacity before initializing; hard ceiling is 990 games (99 unique values × 10 tiers); user sees a clear error if collection exceeds this

### Refresh & Redistribution

- [ ] **REFRESH-01**: User can trigger a manual refresh to redistribute all rankings, rebalancing tier allocations for the current collection size while preserving relative game order

### BGG Sync

- [ ] **SYNC-01**: User can manually trigger a batch sync to push all current decimal ratings to BGG as star ratings
- [ ] **SYNC-02**: App shows progress during sync (e.g. "Syncing 47 / 200...") with per-request throttling (200–500ms between writes) to avoid BGG rate limits
- [ ] **SYNC-03**: If sync is interrupted (page reload, session expiry), the app can resume from where it left off on next attempt using a `lastSyncedRatings` diff

### Display

- [ ] **DISP-01**: BGG thumbnail (cover art) is shown for each game during head-to-head comparison picks
- [ ] **DISP-02**: After picking a winner, the app shows a callout if the chosen game moved up significantly in the rankings (e.g. "Moved up 12 spots")

### Persistence

- [ ] **PERSIST-01**: Current rankings are saved to localStorage after every comparison so they survive page reload
- [ ] **PERSIST-02**: Stored rankings load automatically on return visits in the same browser; if the stored username differs from the logged-in user, the stored rankings are discarded and a fresh seed is offered

## v2 Requirements

### Display

- **DISP-V2-01**: Full ranked list view — ordered list of all games with their decimal ratings
- **DISP-V2-02**: Tier groupings in the ranked list — games visually grouped by tier (10, 9, 8...) with tier label and game count

### Collection Management

- **COLL-V2-01**: Collection reconciliation on return visit — when the user's BGG collection has changed since last visit, new games are merged at random positions and removed games are dropped, without resetting existing rankings
- **COLL-V2-02**: Collection filtering — filter games by play count, ownership status, or "want to rank" flag before entering the comparison loop

### Quality of Life

- **QOL-V2-01**: Single-step undo — reverse the last comparison result

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side storage / user accounts | localStorage is sufficient for personal use; no backend needed |
| Multi-user support | Data model complexity; localStorage is per-browser by nature |
| Auto-sync after every comparison | BGG rate limits; batch sync is the right pattern |
| ELO algorithm | This app's value is the bell-curve model, not statistical convergence |
| CSV / spreadsheet export | BGG sync IS the export mechanism |
| Social / sharing features | Not the core value; adds backend complexity |
| Mobile app / PWA install prompt | Adds packaging complexity; works as a web page |
| Full comparison history / undo stack | Encourages second-guessing; complex state management |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| COLL-01 | — | Pending |
| COLL-02 | — | Pending |
| COLL-03 | — | Pending |
| RANK-01 | — | Pending |
| RANK-02 | — | Pending |
| RANK-03 | — | Pending |
| RANK-04 | — | Pending |
| RANK-05 | — | Pending |
| RANK-06 | — | Pending |
| RANK-07 | — | Pending |
| RANK-08 | — | Pending |
| RANK-09 | — | Pending |
| RANK-10 | — | Pending |
| REFRESH-01 | — | Pending |
| SYNC-01 | — | Pending |
| SYNC-02 | — | Pending |
| SYNC-03 | — | Pending |
| DISP-01 | — | Pending |
| DISP-02 | — | Pending |
| PERSIST-01 | — | Pending |
| PERSIST-02 | — | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 24 ⚠️

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after initial definition*
