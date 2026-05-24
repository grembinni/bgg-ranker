# Phase 2: Collection & Ranking - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

User enters their BGG username (no password required), app fetches their owned board games and previously-rated-but-unowned games, validates collection size (< 990 cap), seeds initial rankings across the bell-curve tiers, and presents head-to-head comparisons. All progress persists to localStorage. No authentication in this phase — password and BGG write access are Phase 3.

**Phase 2 ends when:**
- User can enter a username and load their collection through the Vite dev proxy
- App handles BGG's 202 polling loop transparently
- First comparison pair is presented after initial ranking seed
- Skip, Refresh, and comparison counter all work
- Rankings survive page reload (localStorage)
- If stored username differs from entered username, stored rankings are discarded

**COLL-02 (expansion toggle) is removed from v1 scope** — moved to v2 deferred. Phase 2 fetches boardgames only.

</domain>

<decisions>
## Implementation Decisions

### App Flow / Screens
- **D-01:** Single-page conditional rendering — no React Router. App.tsx switches between views based on Zustand store state. No URL changes.
- **D-02:** Three views only: (1) Username Entry, (2) Collection Loading / 202 polling indicator, (3) Comparison screen. No ranked list view in Phase 2 (DISP-V2-01 is v2 deferred).
- **D-03:** Comparison screen layout: header contains username + session/total comparison counter (RANK-05); Skip and Refresh are secondary buttons below the two game cards.
- **D-04:** Clean utility UI — functional Tailwind styling, no animations, no design polish. Phase 4 is the polish phase. Build for correctness now.

### Game Card Content
- **D-05:** Each comparison card shows: game name + year published. Year disambiguates games with duplicate names. Both fields are present in the BGG collection XML.
- **D-06:** Each card also shows the game's current rank position (e.g. "#47 of 200"). Rank is computed from the sorted ratings array at render time — not stored separately.
- **D-07:** Parse and store thumbnail URL for every game in CollectionState now, even though Phase 2 does not display it. The `Game` type includes a `thumbnail: string` field from day one. Phase 4 reads it from the already-stored collection without re-fetching.

### Username Persistence
- **D-08:** No username persistence to localStorage — username is required on every visit. Returning users always see the username entry form.
- **D-09:** The PERSIST-02 username guard is implemented by embedding username inside `PersistedRankings` (in the `bgg-ranker:v1:rankings` localStorage key) — not as a separate key. On load, compare `storedRankings.username` to the entered username; if different, discard.
- **D-10:** When the user enters a username that matches stored rankings: show a prompt — "Found N ranked games from your last session. Continue ranking or re-fetch collection?" — before loading. User decides. Auto-load without prompt is NOT the behavior.

### Collection Fetch (BGG API)
- **D-11:** COLL-02 (expansion toggle) is removed from v1. Phase 2 uses `subtype=boardgame` on all collection requests. No toggle, no expansion handling.
- **D-12:** COLL-03 (previously-rated unowned games) is in Phase 2 scope. Two collection queries: `own=1&subtype=boardgame` and `rated=1&subtype=boardgame&own=0`. Both run after username entry.
- **D-13:** Deduplication strategy: if a game appears in both the owned and rated-unowned results (same BGG objectid), the owned entry wins. Log a debug note that a duplicate was found and the owned record was kept.

### Ranking Engine Integration
- **D-14:** `initializeRankings` is called once when the collection is first loaded (no stored rankings for this user). Returns integer ratings stored in `RankingsState.ratings`.
- **D-15:** `applyUpset` is called on every comparison pick where winner was ranked below loser. Returns new ratings — store updates `RankingsState.ratings` with the result.
- **D-16:** `redistribute` is called when user triggers manual Refresh (REFRESH-01). Preserves relative order, recomputes spacing. Store updates `RankingsState.ratings`.
- **D-17:** All ratings stored as integers in Zustand and localStorage (`801` = 8.01). Division by 100 happens only at display time when showing decimal labels. The rank position (#47) is derived from array index in sorted ratings, not from the integer value.

### Claude's Discretion
- Pair selection algorithm for RANK-02 (random two games from pool) — Claude decides the selection strategy (e.g., purely random or weighted toward less-compared games)
- Skip queue implementation for RANK-04 — Claude decides queue structure (e.g., append skipped pair to end of a local queue array)
- Exact Zustand slice structure — Claude decides following the ARCHITECTURE.md interface definitions and CLAUDE.md partialize rules
- 202 polling parameters — Claude decides retry count and delay within the documented 8 retries / 3s delay guidelines from CLAUDE.md

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Full requirement list; Phase 2 implements COLL-01, COLL-03, RANK-01–05, REFRESH-01, PERSIST-01, PERSIST-02. COLL-02 is removed from v1 — do not plan it.
- `.planning/ROADMAP.md` — Phase 2 success criteria (6 numbered items)

### Architecture & Patterns
- `.planning/research/ARCHITECTURE.md` — Zustand slice interfaces (SessionState, CollectionState, RankingsState, ComparisonState), localStorage schema, component boundaries, strict rule "UI components never call bggClient directly"
- `.planning/research/PITFALLS.md` — Critical: C1 (202 polling loop), C4 (tier capacity overflow), C5 (float precision). Read before implementing bggClient and store.

### Phase 1 Decisions (carry forward)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-07 (session token as JSON body), D-08 (X-BGG-Session header pattern), D-10 (integer-internal storage), D-11 (tier 1 clamp), D-12 (validateTierCapacity before every init)

### Existing Engine
- `src/engine/rankingEngine.ts` — Fully implemented. `initializeRankings`, `applyUpset`, `redistribute`, `validateTierCapacity`, `TierCapacityError` — all ready. Read the API signatures before writing store code.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/rankingEngine.ts` — Complete bell-curve engine. `initializeRankings(gameIds)` → `Record<string, number>`. `applyUpset(winnerId, loserId, ratings)` → new ratings. `redistribute(ratings)` → new ratings. `validateTierCapacity(count)` → throws `TierCapacityError` if > 990.
- `src/api/bggClient.ts` — Stub. Has `BGG_API_BASE` export (`import.meta.env.VITE_BGG_API_BASE`). All BGG HTTP logic goes here.
- `src/store/store.ts` — Stub with AUTH-03 comment. Implement full Zustand store with persist middleware here.

### Established Patterns
- `VITE_BGG_API_BASE=/bggapi` in `.env.development` — all BGG calls use this prefix. Client code is already wired to `BGG_API_BASE`.
- Integer-internal storage: ratings are integers in all Zustand state and localStorage. Never store as floats.
- localStorage key format: `bgg-ranker:v1:<slice>` — versioned. Use `bgg-ranker:v1:collection` and `bgg-ranker:v1:rankings`.
- Tailwind v4 CSS-first: `@import 'tailwindcss'` in `index.css`. No `tailwind.config.js`. Use Tailwind utility classes directly in components.
- Vitest with `environment: 'node'`, `globals: true`, `include: ['src/**/*.test.ts']` — test files go in `src/`.

### Integration Points
- `src/App.tsx` — Currently just `<h1>BGG Ranker</h1>`. Replace with store-driven conditional view rendering.
- `src/main.tsx` — React entry point. Add `QueryClientProvider` wrapper here if TanStack Query is used for collection fetching.
- `src/components/` — Empty. All Phase 2 UI components go here.
- `rankingEngine.ts` → consumed by `store.ts` — store calls engine functions, never components.

</code_context>

<specifics>
## Specific Ideas

- Rank position display: derive `#47 of 200` from `Object.keys(ratings).length` and the game's sorted index at render time — do not store rank position separately.
- Duplicate deduplication: log duplicate objectids to console at debug level (not a user-facing error). Owned entry keeps its data; the rated-unowned entry is dropped silently.
- Continue-or-refetch prompt: simple inline message on the Username Entry view, not a modal. "Found N ranked games from your last session." with two buttons: "Continue ranking" and "Re-fetch collection".

</specifics>

<deferred>
## Deferred Ideas

- **COLL-02 (expansion toggle)** — removed from v1, moved to v2 deferred. No expansion handling in Phase 2 at all.
- **Ranked list view (DISP-V2-01)** — full ordered list with ratings is v2. Phase 2 comparison screen only.
- **Tier groupings in ranked list (DISP-V2-02)** — v2.

</deferred>

---

*Phase: 2-Collection-Ranking*
*Context gathered: 2026-05-23*
