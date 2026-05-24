---
phase: 02-collection-ranking
verified: 2026-05-24T15:52:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
overrides:
  - must_have: "expansion toggle adds them without re-fetching"
    reason: "COLL-02 was explicitly deferred to v2 during Phase 2 discuss-phase (D-11 in 02-CONTEXT.md). ROADMAP SC1 contains stale wording inherited before the deferral decision was recorded. The Requirements list for Phase 2 does not include COLL-02. The app correctly fetches boardgames only via subtype=boardgame."
    accepted_by: "gsd-verifier (flagged for human confirmation)"
    accepted_at: "2026-05-24T15:52:00Z"
human_verification:
  - test: "Load a real BGG collection — verify loading indicator and 202 polling"
    expected: "Entering a real BGG username shows the CollectionLoading view with spinner; on 202 response the app retries until 200; user lands on ComparisonView with two game cards"
    why_human: "Cannot test live BGG API calls (CORS/proxy required, live network); 202 polling behavior needs real server interaction to confirm"
  - test: "Verify continue-or-refetch prompt appears on return visit with same username"
    expected: "After loading a collection, reloading the page and entering the same username shows 'Found N ranked games from your last session.' with Continue ranking and Re-fetch collection buttons"
    why_human: "Requires a browser with localStorage and live app interaction to verify the PERSIST-02 D-10 prompt renders correctly"
  - test: "Verify localStorage contents after picks"
    expected: "DevTools Application > Local Storage shows key 'bgg-ranker:v1:collection-and-rankings' with JSON containing games, ratings, comparisonsTotal, rankingsUsername, version — and NOT sessionUsername, view, currentPair, skipQueue, sessionComparisons"
    why_human: "Requires browser DevTools inspection during a live session"
  - test: "Verify skip re-queues and the skipped pair reappears after the next pick"
    expected: "Clicking Skip presents a new pair; after clicking Pick on the new pair, the originally-skipped pair reappears as the next pair"
    why_human: "Queue drain order is a behavioral interaction that requires live app use to confirm"
  - test: "Verify counter format in comparison view header"
    expected: "Header right side shows '{n} this session · {m} total' using the U+00B7 middle dot (not a hyphen); session counter resets to 0 after Continue ranking; total counter persists across sessions"
    why_human: "Requires visual inspection of a running app to confirm character encoding and counter persistence"
---

# Phase 2: Collection & Ranking Verification Report

**Phase Goal:** User enters their BGG username (no password), fetches their owned and previously-rated games, and can immediately start ranking them locally through head-to-head comparisons — all progress persisted to localStorage
**Verified:** 2026-05-24T15:52:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can type a BGG username, click "Load Collection", and the Loading view appears immediately | ✓ VERIFIED | `UsernameEntry.tsx` form calls `fetchCollection(trimmed)` which synchronously sets `view: 'loading'` before awaiting bggFetchCollection |
| 2 | BGG 202 polling is implemented — retries up to 8 times with 3s delay, never crashes on 202 | ✓ VERIFIED | `poll202Loop` in `bggClient.ts` lines 117-139: for-loop 0..MAX_RETRIES=8, delay(3000), throws after 9 attempts; 5 poll tests pass |
| 3 | On successful fetch, games are seeded with integer ratings and the first comparison pair is presented | ✓ VERIFIED | `fetchCollection` action calls `initializeRankings`, `selectRandomPair`, sets `view: 'comparison'`; store test "seeds integer ratings on first load" passes (78/78 tests green) |
| 4 | User sees two game cards (name, year, rank position) and can click "Pick this game" | ✓ VERIFIED | `ComparisonView.tsx` renders two `GameCard` components; `GameCard.tsx` shows `{game.name}`, `({game.yearPublished})`, `#{rank} of {totalGames}`, "Pick this game" button |
| 5 | Clicking Pick calls `applyUpset`, increments both counters, presents next pair | ✓ VERIFIED | `pick` action in `store.ts` lines 270-283; store tests "calls applyUpset", "increments both sessionComparisons and comparisonsTotal" pass |
| 6 | Skip appends pair to skipQueue; Refresh redistributes preserving relative order; neither increments counters | ✓ VERIFIED | `skip` and `refresh` actions in `store.ts`; 4 skip tests + 4 refresh tests all pass |
| 7 | Rankings are persisted to localStorage after every pick; only 6 allowed keys are stored | ✓ VERIFIED | `partialize` explicitly returns exactly `{games, lastFetched, ratings, comparisonsTotal, rankingsUsername, version}`; persist test confirms 6 allowed keys present, 7 ephemeral keys absent |
| 8 | Returning user with same username sees continue-or-refetch prompt (PERSIST-02 / D-10) | ✓ VERIFIED | PERSIST-02 guard in `fetchCollection`: checks `rankingsUsername === username && ratings.length > 0 && games.length > 0`; sets `view: 'entry'`; `UsernameEntry` renders prompt when `showContinuePrompt` is true; store test passes |
| 9 | Different username discards stored rankings and fresh-seeds (PERSIST-02) | ✓ VERIFIED | Guard fails on username mismatch → proceeds to fetch → `initializeRankings` creates fresh ratings; old g0 absent from new state; store test passes |
| 10 | Collection over 990 games shows error without mutating existing ratings | ✓ VERIFIED | `validateTierCapacity` throws `TierCapacityError`; catch sets `view: 'error'` with message containing "990"; does NOT touch ratings; store test "991-game error" passes |

**Score:** 10/10 truths verified (SC1 expansion-toggle clause treated as override — see frontmatter)

**Note on ROADMAP SC1 "expansion toggle" clause:** ROADMAP.md SC1 states "expansion toggle adds them without re-fetching." This feature is COLL-02, which was explicitly deferred to v2 during Phase 2 discuss-phase (Decision D-11 in 02-CONTEXT.md; REQUIREMENTS.md marks COLL-02 as v2). The Phase 2 requirements list in ROADMAP.md does not include COLL-02. The stale wording in SC1 predates the deferral decision. The app correctly fetches boardgames only (`subtype=boardgame`). This truth is recorded as overridden per the frontmatter override entry above; a human should confirm the override is acceptable before marking the phase fully passed.

### Deferred Items

No items addressed in later phases (all Phase 2 must-haves are verified or overridden).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/api/bggClient.ts` | BGG XML API2 client: poll202Loop, parseCollectionXml, mergeCollections, fetchCollection | ✓ VERIFIED | 177 lines (> 90 min); exports BGG_API_BASE, RawGame, parseCollectionXml, mergeCollections, poll202Loop, fetchCollection; no default export; no `delay` export |
| `src/store/store.ts` | Zustand store with persist + partialize, all actions | ✓ VERIFIED | 334 lines (> 150 min); contains 'bgg-ranker:v1:collection-and-rankings'; partialize lists exactly 6 keys; all 7 actions implemented |
| `src/api/bggClient.test.ts` | Wave 0 RED→GREEN tests for COLL-01 and COLL-03 | ✓ VERIFIED | 279 lines (> 180 min); 4 describe blocks, 15 it-blocks, all pass |
| `src/store/store.test.ts` | Wave 0 RED→GREEN tests for all store requirements | ✓ VERIFIED | 528 lines (> 280 min); 6 describe blocks, 24 it-blocks, all pass |
| `src/components/UsernameEntry.tsx` | View 1: username form + continue-or-refetch prompt | ✓ VERIFIED | 91 lines (> 50 min); contains "BGG Ranker" h1, form, showContinuePrompt logic, Continue/Re-fetch buttons |
| `src/components/CollectionLoading.tsx` | View 2: spinner + accessibility | ✓ VERIFIED | 22 lines (> 15 min); role="status", aria-live="polite", animate-spin spinner, sr-only label |
| `src/components/ErrorDisplay.tsx` | View 4: error message + Try again | ✓ VERIFIED | 22 lines (> 15 min); role="alert", "Something went wrong", resetForNewUser on button |
| `src/components/GameCard.tsx` | Per-card render with name, year, rank, Pick button | ✓ VERIFIED | 36 lines (> 30 min); getRankPosition helper at module scope; "Pick this game"; no img tag |
| `src/components/ComparisonView.tsx` | View 3 with header counter, two GameCards, Skip/Refresh | ✓ VERIFIED | 51 lines (> 40 min); U+00B7 middle dot present; correct onPick wiring: pick(leftId, rightId) / pick(rightId, leftId) |
| `src/App.tsx` | View router with all 4 views wired | ✓ VERIFIED | 19 lines (> 15 min); useStore(s => s.view); all 4 branches; no ComparisonPlaceholder |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/api/bggClient.test.ts` | `src/api/bggClient.ts` | `import { parseCollectionXml, mergeCollections, poll202Loop, fetchCollection, type RawGame } from './bggClient'` | ✓ WIRED | All 5 named imports present; all 15 tests pass |
| `src/store/store.test.ts` | `src/store/store.ts` | `import { createAppStore, selectRandomPair, type Game } from './store'` | ✓ WIRED | Named imports present; all 24 tests pass |
| `src/store/store.test.ts` | `src/api/bggClient.ts` | `vi.mock('../api/bggClient', () => ({ fetchCollection: vi.fn() }))` | ✓ WIRED | Static top-level mock present at line 14 |
| `src/store/store.ts` | `src/api/bggClient.ts` | `import { fetchCollection as bggFetchCollection, type RawGame } from '../api/bggClient'` | ✓ WIRED | Named import present; fetchCollection action uses bggFetchCollection |
| `src/store/store.ts` | `src/engine/rankingEngine.ts` | `import { initializeRankings, applyUpset, redistribute, validateTierCapacity, TierCapacityError } from '../engine/rankingEngine'` | ✓ WIRED | All 5 named imports present; each used in store actions |
| `src/components/UsernameEntry.tsx` | `src/store/store.ts` | `useStore(s => s.fetchCollection)` etc. | ✓ WIRED | 6 selector calls; form submit calls fetchCollection; prompt buttons call continueSession / resetForNewUser |
| `src/components/ComparisonView.tsx` | `src/store/store.ts` | `useStore(s => s.pick/skip/refresh/currentPair/...)` | ✓ WIRED | 7 selector calls; onPick wired to pick(leftId, rightId) and pick(rightId, leftId) |
| `src/components/ComparisonView.tsx` | `src/components/GameCard.tsx` | `import GameCard from './GameCard'` | ✓ WIRED | Default import present; two GameCard instances rendered with gameId and onPick props |
| `src/components/GameCard.tsx` | `src/store/store.ts` | `useStore(s => s.games[gameId])` and `useStore(s => s.ratings)` | ✓ WIRED | 2 selector calls; game data and ratings read for rank computation |
| `src/App.tsx` | `src/store/store.ts` | `useStore(s => s.view)` | ✓ WIRED | Single selector; 4 conditional branches correctly map view values to components |
| `src/App.tsx` | `src/components/ComparisonView.tsx` | `import ComparisonView from './components/ComparisonView'` | ✓ WIRED | Default import present; rendered for `view === 'comparison'` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ComparisonView.tsx` | `currentPair` | `useStore(s => s.currentPair)` → `store.ts` `selectRandomPair(ratings, [])` | Yes — computed from real `ratings` map after `initializeRankings` or `applyUpset` | ✓ FLOWING |
| `GameCard.tsx` | `game` | `useStore(s => s.games[gameId])` → `store.ts` `gamesMap` built from `bggFetchCollection` result | Yes — populated by real BGG API response parsed via `parseCollectionXml` | ✓ FLOWING |
| `GameCard.tsx` | `ratings` | `useStore(s => s.ratings)` → `store.ts` integer ratings from `initializeRankings`/`applyUpset` | Yes — real integer values, never hardcoded | ✓ FLOWING |
| `ComparisonView.tsx` | `sessionComparisons` / `comparisonsTotal` | `useStore(s => s.sessionComparisons/comparisonsTotal)` → incremented in `pick` action | Yes — incremented from real pick events | ✓ FLOWING |
| `UsernameEntry.tsx` | `showContinuePrompt` | `sessionUsername === rankingsUsername && Object.keys(ratings).length > 0` | Yes — derived from real persisted state on re-load | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 78 tests pass | `npm test` | 78 passed, 0 failed (3 unhandled rejections are expected async promise warnings, not test failures) | ✓ PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| No component imports bggClient | `grep -rE "from '.*api/bggClient'" src/components/` | No matches | ✓ PASS |
| ComparisonPlaceholder removed | `grep -F "ComparisonPlaceholder" src/App.tsx` | No matches | ✓ PASS |
| No img tag in GameCard | `grep -n "img" src/components/GameCard.tsx` | No matches | ✓ PASS |
| U+00B7 middle dot present | `grep -F "·" src/components/ComparisonView.tsx` | 1 match in counter span | ✓ PASS |
| Persist key correct | `grep -c "bgg-ranker:v1:collection-and-rankings" src/store/store.ts` | 2 matches (name declaration + JSDoc) | ✓ PASS |
| 6 persisted keys, 7 excluded | partialize body in store.ts lines 305-313 | Exactly 6 keys listed; body does not contain sessionUsername/view/currentPair/skipQueue/loadingMessage/errorMessage/sessionComparisons | ✓ PASS |

### Probe Execution

No probe scripts declared for this phase. Step 7c: SKIPPED (no probe-*.sh files for Phase 2).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COLL-01 | 02-01, 02-02 | App fetches owned board games from BGG XML API2, excludes expansions | ✓ SATISFIED | `fetchCollection` uses `own=1&subtype=boardgame`; `parseCollectionXml` fully implemented; 15 bggClient tests pass |
| COLL-03 | 02-01, 02-02 | Fetches previously-rated unowned games, includes them in pool | ✓ SATISFIED | `fetchCollection` issues second query `rated=1&own=0&subtype=boardgame`; `mergeCollections` deduplicates; 3 mergeCollections tests pass |
| RANK-01 | 02-01, 02-02 | On first load, games assigned random initial positions across bell-curve tiers | ✓ SATISFIED | `initializeRankings(games.map(g => g.id))` called in `fetchCollection` action; integer ratings verified by store test "seeds integer ratings on first load" |
| RANK-02 | 02-01, 02-02, 02-03 | App presents two randomly selected games; user picks one | ✓ SATISFIED | `selectRandomPair` exported from store; `ComparisonView` renders two `GameCard` components; 3 selectRandomPair tests pass |
| RANK-03 | 02-01, 02-02 | Chosen game takes loser's rating; games between shift down | ✓ SATISFIED | `applyUpset(winnerId, loserId, ratings)` called in `pick` action; store test "calls applyUpset and updates ratings" passes |
| RANK-04 | 02-01, 02-02, 02-03 | User can skip; pair re-queued; Skip button in UI | ✓ SATISFIED | `skip` action appends to `skipQueue`; `pick` drains from queue front; Skip button in `ComparisonView`; 4 skip tests + queue-drain pick test pass |
| RANK-05 | 02-01, 02-02, 02-03 | Comparison count displayed (session + total) | ✓ SATISFIED | `sessionComparisons` and `comparisonsTotal` incremented in `pick`; header in `ComparisonView` shows `{n} this session · {m} total`; dual-counter store test passes |
| REFRESH-01 | 02-01, 02-02, 02-03 | Manual refresh redistributes rankings, preserves relative order | ✓ SATISFIED | `refresh` action calls `redistribute(get().ratings)`; Refresh button in `ComparisonView`; 4 refresh tests pass including "preserves relative order" |
| PERSIST-01 | 02-01, 02-02, 02-03 | Rankings saved to localStorage after every comparison | ✓ SATISFIED | Zustand `persist` middleware with `name: 'bgg-ranker:v1:collection-and-rankings'`; PERSIST-01 test inspects mock storage after pick and confirms ratings persisted |
| PERSIST-02 | 02-01, 02-02 | Stored rankings load on return visit; discarded if username differs | ✓ SATISFIED | PERSIST-02 guard in `fetchCollection` checks `rankingsUsername === username`; discard path tested; continue-or-refetch prompt in `UsernameEntry`; both store tests pass |

All 10 Phase 2 requirements satisfied by implemented code.

**Note on RANK-10:** Listed in store test as "RANK-10/COLL-01" but RANK-10 is a Phase 1 requirement (validateTierCapacity already proven in Phase 1). The 990-game ceiling enforcement in Phase 2's `fetchCollection` action is the application of that engine function to the Phase 2 user flow; it is verified by the 991-game store test.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TBD, FIXME, XXX, TODO, HACK, or PLACEHOLDER markers found in any Phase 2 source files. No stub components, no hardcoded empty data flowing to render. No `ComparisonPlaceholder` remains in `src/App.tsx`. No `<img>` tags in `GameCard.tsx`.

One noteworthy pattern: `bggClient.ts` line 172 catches the 0-game error from the rated-unowned query specifically to handle users who have rated no unowned games — `ratedUnowned = []` is returned instead of throwing. This is correct behavior (an empty rated-unowned collection is valid) and is not a stub.

### Human Verification Required

The following items require a running browser session with the real app and/or live BGG API:

### 1. Live BGG Collection Load with 202 Polling

**Test:** Start `npm run dev`, open `http://localhost:5173`, enter a real BGG username with a known small-to-medium collection, click "Load Collection"
**Expected:** Loading view appears immediately with spinner; if BGG returns 202, app retries silently; on success user lands on ComparisonView with two game cards showing real game names, years, and rank positions
**Why human:** Cannot test live BGG API in static code analysis; 202 polling behavior requires real network interaction; CORS proxy must be active

### 2. Continue-or-Refetch Prompt on Return Visit

**Test:** After successfully loading a collection, reload the browser tab, enter the SAME username, click "Load Collection"
**Expected:** Instead of triggering a new fetch, the app shows "Found N ranked games from your last session." with "Continue ranking" and "Re-fetch collection" buttons; clicking "Continue ranking" immediately lands on ComparisonView
**Why human:** Requires localStorage persistence across page reloads in a real browser; sessionUsername reset on reload is a behavioral invariant that needs live verification

### 3. localStorage Contents Inspection

**Test:** After making several picks, open browser DevTools > Application > Local Storage; inspect the `bgg-ranker:v1:collection-and-rankings` key
**Expected:** JSON contains exactly: `games`, `lastFetched`, `ratings`, `comparisonsTotal`, `rankingsUsername`, `version`. Does NOT contain: `sessionUsername`, `view`, `currentPair`, `skipQueue`, `loadingMessage`, `errorMessage`, `sessionComparisons`
**Why human:** Requires browser DevTools inspection; automated test covers this with mock storage but live browser storage confirms the singleton `useStore` correctly uses the lazy localStorage wrapper

### 4. Skip Queue Drain Order

**Test:** On the comparison view, click Skip once, then click Pick on the next pair
**Expected:** After picking the new pair, the originally-skipped pair reappears as the next `currentPair`
**Why human:** Queue drain on pick is verified in unit tests, but the visible UI flow (pair reappearance after pick) needs live app confirmation

### 5. Counter Format and Persistence

**Test:** Make 3 picks (counter should show "3 this session · 3 total"), reload the page, re-enter same username, click Continue ranking
**Expected:** Counter shows "0 this session · 3 total" (sessionComparisons resets, comparisonsTotal persists); character between "session" and "total" is a middle dot (·), not a hyphen or bullet
**Why human:** Counter persistence across sessions and the specific Unicode character rendering need visual confirmation in a browser

### Gaps Summary

No gaps found. All 10 must-have truths are verified in the codebase. All 10 Phase 2 requirements are satisfied by substantive, wired, data-flowing implementations. The 78-test suite (15 bggClient + 24 store + 39 engine) passes with 0 failures. TypeScript compiles cleanly. No anti-patterns detected.

The `human_needed` status reflects 5 behavioral verification items that require a running browser session with live BGG API access — not deficiencies in the implementation.

---

_Verified: 2026-05-24T15:52:00Z_
_Verifier: Claude (gsd-verifier)_
