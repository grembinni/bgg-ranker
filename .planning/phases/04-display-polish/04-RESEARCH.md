# Phase 4: Display Polish — Research

**Researched:** 2026-05-25
**Domain:** React component surgery + Zustand state extension
**Confidence:** HIGH

## Summary

Phase 4 is a contained UI polish pass on an already-working codebase. All three feature areas
(thumbnail upgrade, upset callout, login/nav overhaul) operate entirely within the existing React
+ Zustand + Tailwind 4 stack — no new packages are needed. The codebase is well-understood from
deep code reading in this session: `GameCard.tsx`, `ComparisonView.tsx`, `store.ts`, and
`App.tsx` have been fully read.

The upset callout and hamburger menu require small Zustand state additions (`lastUpset` field,
`logout` action) and JavaScript timer management that precisely mirrors the existing
`completeSyncTimer` pattern in `store.ts`. The login flow change reduces complexity: the
"Continue session?" prompt and its branching logic are removed in favour of a simpler
auto-resume path already partially present in `fetchCollection`'s PERSIST-02 guard.

The test surface for this phase is component-level JSdom rendering, matching the pattern
established by `ComparisonView.test.tsx` and `SyncingView.test.tsx`.

**Primary recommendation:** Implement in two plans — Plan 04-01 (store extension + GameCard +
upset callout + hamburger) and Plan 04-02 (login auto-resume overhaul + tests) — following the
existing atomic-commit convention.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Upset trigger on any upset — whenever `winnerPos > loserPos` in `applyUpset`. No minimum threshold.
- **D-02:** Callout text format: `"[Game name] moved up N spots"` (singular: "1 spot").
- **D-03:** Auto-clear after 5 seconds via `setTimeout`. Session-only (not persisted). Stored as `lastUpset: { winnerName: string; spotsGained: number } | null` in `ComparisonStateSlice`.
- **D-04:** Callout placement: full-width row between the 2-column card grid and the action buttons. Hidden (no reserved slot) when `lastUpset` is null.
- **D-05:** Callout visual: `bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-2 text-center text-sm`.
- **D-06:** GameCard thumbnail upgrade: `h-48`, `object-contain`, `aspect-square`; wrapped in `<a href="https://boardgamegeek.com/boardgame/{game.id}" target="_blank" rel="noopener noreferrer">`; gray placeholder box when no URL; rank shows only `#N` (drop "of N total").
- **D-07:** Login always collects username + password; after success: auto-resume if `rankingsUsername === username && ratings/games exist`, else `fetchCollection`. Remove "Continue session?" prompt.
- **D-08:** Hamburger in top-left of comparison header; dropdown with Sync to BGG, Refresh rankings, Logout; Sync disabled when `dirtyGameIds.length === 0 || !sessionId`; Logout clears session, does NOT clear rankings.
- **D-09:** New comparison header layout: `[☰ hamburger] · [N this session · N total] · [username]` — flex justify-between.

### Claude's Discretion
None identified in discussion — all implementation details were locked.

### Deferred Ideas (OUT OF SCOPE)
- Firebase production deploy (Phase 5)
- Full ranked list view (v2)
- Any new comparison algorithm changes
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISP-01 | BGG thumbnail (cover art) shown during head-to-head comparison picks | GameCard already has thumbnail img at h-32; upgrade to h-48 + placeholder + BGG link (D-06) |
| DISP-02 | Upset callout shown after picking a winner ranked significantly lower than loser | `applyUpset` already exposes `winnerPos`/`loserPos` semantics; extend `pick()` to detect and store `lastUpset`; render amber callout in ComparisonView (D-01 through D-05) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Thumbnail display | Browser / Client | — | Pure render — image URL already in game record, no API call needed |
| Thumbnail placeholder | Browser / Client | — | Conditional render within GameCard; no data fetch |
| Upset detection | API / Backend (store) | — | Store owns comparison logic; `pick()` extends to compute spotsGained |
| Upset callout render | Browser / Client | — | ComparisonView reads `lastUpset` from store, renders amber div |
| Upset callout timer | API / Backend (store) | — | setTimeout lives in store action alongside `completeSyncTimer` pattern |
| Hamburger menu state | Browser / Client | — | Local component state (`isOpen: boolean`) — no store involvement |
| Hamburger actions (Sync, Refresh, Logout) | API / Backend (store) | — | Actions already in store; hamburger just calls them |
| Logout action | API / Backend (store) | — | New `logout()` action in store; clears session, preserves rankings |
| Login auto-resume | API / Backend (store) | — | Extend `login()` to detect PERSIST-02 match and call `continueSession()` instead of `fetchCollection()` |
| Entry form (login UI) | Browser / Client | — | `UsernameEntry.tsx` already collects username + password; remove continue-prompt branch |

## Standard Stack

No new packages are required for Phase 4. All capabilities are achieved with the locked stack.

### Core (existing, no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | `^19.0.0` | Component rendering | Project stack |
| Zustand 5 | `^5.0.13` | State management | Project stack |
| Tailwind 4 | `^4.3.0` | Utility CSS | Project stack |
| Vitest 4 | `^4.1.7` | Test runner | Project stack |
| @testing-library/react | `^16.3.2` | Component testing | Project stack |

### No New Packages

Phase 4 requires zero additional npm installs. Specifically:

- **Hamburger open/close:** local React `useState` — no animation library needed; the CONTEXT confirms a plain dropdown following existing `rounded border px-4 py-2` patterns.
- **Timer management:** native `setTimeout`/`clearTimeout` — mirrors `completeSyncTimer` pattern already in `store.ts`.
- **Image placeholder:** inline Tailwind div — no image library needed.
- **Amber callout:** Tailwind utility classes — already defined verbatim in D-05.

## Package Legitimacy Audit

No packages are installed in this phase.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User action (Pick button)
        │
        ▼
store.pick(winnerId, loserId)
        │
        ├─── applyUpset(winnerId, loserId, ratings)
        │        └─ returns newRatings
        │
        ├─── winnerPos / loserPos from pre-upset rankings
        │        └─ if winnerPos > loserPos → upset detected
        │
        ├─── set({ lastUpset: { winnerName, spotsGained } })
        │
        └─── schedule upsetTimer = setTimeout(clear, 5000)
                      (cancel any previous upsetTimer first)

ComparisonView
        │
        ├─── reads lastUpset from store
        │        └─ if non-null → renders amber callout row
        │        └─ if null → renders nothing (no layout shift)
        │
        ├─── reads games, ratings → GameCard × 2
        │        └─ GameCard: h-48 img (or placeholder) + #N rank + BGG link
        │
        └─── Header: [☰] [counter] [username]
                  └─ ☰ click → isOpen toggle (local state)
                  └─ dropdown: Sync | Refresh | Logout
                        └─ Logout → store.logout()
                              └─ clears sessionId, sessionUsername
                              └─ set({ view: 'entry' })
                              └─ does NOT clear ratings/games/rankingsUsername

User logs in (entry view)
        │
store.login(username, password)
        │
        ├─── bggLogin(username, password) → sessionId
        │
        └─── if rankingsUsername === username
             AND ratings/games exist
               → continueSession()       ← auto-resume path
             else
               → fetchCollection(username)
```

### Recommended Project Structure

No new directories. All changes are in-place edits to existing files plus one new file for tests.

```
src/
├── components/
│   ├── GameCard.tsx          ← EDIT: h-48, placeholder, BGG link, #N rank
│   ├── ComparisonView.tsx    ← EDIT: hamburger header, callout row, remove old buttons
│   └── ComparisonView.test.tsx ← EDIT: extend with Phase 4 assertions
├── store/
│   └── store.ts              ← EDIT: add lastUpset + upsetTimer + logout action; extend login() + pick()
└── components/
    └── UsernameEntry.tsx     ← EDIT: remove continue-prompt branch
```

### Pattern 1: Module-Level Timer (mirrors completeSyncTimer)

**What:** A module-level variable holds the timer handle so it can be cancelled across calls.
**When to use:** Whenever a Zustand action schedules a delayed state clear that must be idempotently cancellable.

```typescript
// Source: existing store.ts pattern (completeSyncTimer)
let upsetTimer: ReturnType<typeof setTimeout> | null = null

// Inside pick():
if (upsetTimer) { clearTimeout(upsetTimer); upsetTimer = null }
upsetTimer = setTimeout(() => {
  upsetTimer = null
  set({ lastUpset: null })
}, 5000)
```

### Pattern 2: Conditional Callout (no layout shift)

**What:** Render nothing when state is null rather than reserving a slot.
**When to use:** When the callout absence should not shift other elements.

```tsx
// Source: CONTEXT.md D-04 decision
{lastUpset !== null && (
  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-2 text-center text-sm">
    {lastUpset.winnerName} moved up {lastUpset.spotsGained} {lastUpset.spotsGained === 1 ? 'spot' : 'spots'}
  </div>
)}
```

### Pattern 3: Hamburger Menu with Local State

**What:** A boolean `isOpen` in component state controls dropdown visibility. No store involvement.
**When to use:** Ephemeral UI toggle with no persistence or cross-component sharing need.

```tsx
// Source: established React pattern; consistent with CONTEXT.md D-08
const [menuOpen, setMenuOpen] = useState(false)

// Dismiss on action:
const handleSync = () => { setMenuOpen(false); startSync() }
const handleRefresh = () => { setMenuOpen(false); refresh() }
const handleLogout = () => { setMenuOpen(false); logout() }
```

### Pattern 4: Thumbnail with Placeholder

**What:** Replace the conditional `{game.thumbnail && <img/>}` with a ternary that renders a placeholder div when URL is absent.
**When to use:** Always — per D-06.

```tsx
// Source: CONTEXT.md D-06; existing pattern at GameCard.tsx line 33-39
{game.thumbnail ? (
  <a href={`https://boardgamegeek.com/boardgame/${game.id}`} target="_blank" rel="noopener noreferrer">
    <img
      src={game.thumbnail.startsWith('//') ? `https:${game.thumbnail}` : game.thumbnail}
      alt={game.name}
      className="w-full h-48 object-contain aspect-square"
    />
  </a>
) : (
  <div className="h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm aspect-square">
    No image
  </div>
)}
```

### Pattern 5: Login Auto-Resume

**What:** After successful `bggLogin`, check if stored rankings belong to the same user — if yes, skip refetch.
**When to use:** In `login()` action after `sessionId` is obtained.

```typescript
// Source: CONTEXT.md D-07; existing fetchCollection PERSIST-02 guard
const state = get()
if (
  state.rankingsUsername === username &&
  Object.keys(state.ratings).length > 0 &&
  Object.keys(state.games).length > 0
) {
  get().continueSession()
} else {
  await get().fetchCollection(username)
}
```

### Anti-Patterns to Avoid

- **Timer in React state:** Do not put the timer handle in `useState` or Zustand state — it will serialize to null in persist and cause timer leaks. Use a module-level variable exactly as `completeSyncTimer` does. [VERIFIED: store.ts line 152]
- **Layout-shift reserved slot:** Do not render `<div style={{visibility: 'hidden'}}>` for the callout when `lastUpset` is null — D-04 explicitly says "Hidden when null — no layout shift caused by a reserved slot." Use conditional render (render nothing).
- **Callout cleared only by timer:** The `pick()` action should cancel any previous `upsetTimer` before setting a new one. If the user picks rapidly, a stale timer from pick N would otherwise clear the callout set by pick N+1. [VERIFIED: CONTEXT.md D-03 — "Cancel any previous timer first"]
- **Logout clearing rankings:** D-08 explicitly specifies: "Does NOT clear stored rankings (a re-login with the same username will auto-resume)." The `logout()` action must NOT call `resetForNewUser()`.
- **fetchCollection called in login() for same user:** The current `login()` in `store.ts` delegates unconditionally to `fetchCollection()`. Post-Phase 4, it must check the PERSIST-02 guard BEFORE calling `fetchCollection()`, because `fetchCollection()` itself only detects the returning-user case to redirect to entry view (old "Continue?" path), not to auto-resume.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timer cancellation across re-renders | Timer ref in React state or Zustand | Module-level variable (`let upsetTimer`) | React state causes re-renders; persist middleware serializes it to null |
| Spots gained calculation | Custom position diff logic | Read `winnerPos` and `loserPos` from `applyUpset`'s pre-computed `ranked` array | `applyUpset` already computes both; spotsGained = loserPos - winnerPos |
| Dropdown dismiss-on-outside-click | Custom event listener on `document` | Skip for MVP — hamburger closes on action click | CONTEXT.md doesn't require outside-click dismiss; avoid complexity |

**Key insight:** The spots-gained value is `loserPos - winnerPos` computed from the pre-upset `ranked` array inside `pick()`. The `applyUpset` function already sorts all games and finds both positions — `pick()` just needs to replicate that sort on the state before calling `applyUpset`, or `applyUpset` can be called for detection and its intermediate values reused. The simplest approach: inline the position lookup in `pick()` using the same `Object.entries(ratings).sort((a,b) => b[1]-a[1])` pattern.

## Common Pitfalls

### Pitfall 1: Timer Leak on Rapid Picks

**What goes wrong:** User picks game A (timer starts for callout A), then immediately picks game B (timer B starts). Timer A fires 5s later and clears callout B.
**Why it happens:** Two independent `setTimeout` calls are active simultaneously.
**How to avoid:** Before setting `upsetTimer`, always `clearTimeout(upsetTimer)`. This is the same pattern as `completeSyncTimer` in `completeSyncAll()`.
**Warning signs:** Callout disappears unexpectedly during rapid picking in manual testing.

### Pitfall 2: Wrong Upset Detection in pick()

**What goes wrong:** The `pick()` action reads `winnerPos` and `loserPos` AFTER calling `applyUpset`, which produces a new ratings map — the positions in the new map are different from the pre-upset positions.
**Why it happens:** Calling `applyUpset` first mutates relative order.
**How to avoid:** Compute the sorted ranked array from the CURRENT (pre-upset) `ratings` before calling `applyUpset`. Then extract `winnerPos` and `loserPos` from that pre-upset array.
**Warning signs:** Callout shows wrong spot count, or fires when it shouldn't.

### Pitfall 3: fetchCollection's Returning-User Branch Conflicts with D-07

**What goes wrong:** `login()` calls `fetchCollection(username)` — `fetchCollection` detects the PERSIST-02 match and sets `view: 'entry'` (the old "Continue?" prompt), so the user sees the entry screen again instead of auto-resuming.
**Why it happens:** `fetchCollection`'s PERSIST-02 guard was designed for the old flow where `fetchCollection` was called directly from the entry form.
**How to avoid:** In `login()`, check the PERSIST-02 condition (same username, ratings and games non-empty) BEFORE calling `fetchCollection`. If matched, call `continueSession()` directly and return. Remove the "Continue session?" render block from `UsernameEntry.tsx` at the same time.
**Warning signs:** After logging in as the same user, the entry screen appears briefly or the "Found N ranked games" prompt reappears.

### Pitfall 4: Hamburger Sync Button Disabled State

**What goes wrong:** The hamburger's Sync item is enabled when either `dirtyGameIds.length === 0` OR `!sessionId`.
**Why it happens:** Copying the existing ComparisonView sync logic incorrectly.
**How to avoid:** `const syncDisabled = !sessionId || dirtyGameIds.length === 0` — the same expression as the current header button. Apply the same `disabled` attribute and visual opacity to the menu item. [VERIFIED: CONTEXT.md D-08 and ComparisonView.tsx line 20]

### Pitfall 5: lastUpset Not Excluded from persist partialize

**What goes wrong:** `lastUpset` persists across page reloads and fires a stale callout on return.
**Why it happens:** Adding a field to the slice without checking `partialize`.
**How to avoid:** `lastUpset` is session-only. It must NOT appear in `partialize` — exactly the same rule as `sessionId`, `syncStatus`, `sessionComparisons`, etc. [VERIFIED: CONTEXT.md D-03 — "session-only (not persisted)"; store.ts partialize at line 542-554]

### Pitfall 6: ComparisonView Mock Missing lastUpset and logout

**What goes wrong:** Existing `ComparisonView.test.tsx` mocks the store without `lastUpset` or `logout`. Tests break or the component throws on `undefined` access.
**Why it happens:** Mock object is not extended when new store fields are added.
**How to avoid:** When extending the store, always update `ComparisonView.test.tsx`'s mock object with the new fields (`lastUpset: null`, `logout: vi.fn()`).

## Code Examples

Verified patterns from codebase reading:

### Existing timer pattern to mirror (upsetTimer)

```typescript
// Source: store.ts line 152 — completeSyncTimer pattern
let completeSyncTimer: ReturnType<typeof setTimeout> | null = null
// ...
completeSyncTimer = setTimeout(() => {
  completeSyncTimer = null
  set({ view: 'comparison', syncStatus: 'idle' })
}, 2000)
```

### Existing partialize (lastUpset must NOT appear here)

```typescript
// Source: store.ts lines 542-554 — partialize excludes session-only fields
partialize: (state) => ({
  games: state.games,
  lastFetched: state.lastFetched,
  ratings: state.ratings,
  comparisonsTotal: state.comparisonsTotal,
  rankingsUsername: state.rankingsUsername,
  version: state.version,
  dirtyGameIds: state.dirtyGameIds,
  comparisonsAtLastSync: state.comparisonsAtLastSync,
  unplayedIds: state.unplayedIds,
  // lastUpset: NOT listed — session-only
})
```

### Existing applyUpset position detection (reuse in pick())

```typescript
// Source: rankingEngine.ts lines 172-178
const ranked = Object.entries(ratings).sort((a, b) => b[1] - a[1])
const winnerPos = ranked.findIndex(([id]) => id === winnerId)
const loserPos = ranked.findIndex(([id]) => id === loserId)
// upset when winnerPos > loserPos (lower ranked beats higher ranked)
```

### Existing ComparisonView mock structure (extend, don't replace)

```typescript
// Source: ComparisonView.test.tsx lines 33-55 — must add lastUpset, logout, refresh
vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      // ... existing fields ...
      lastUpset: null,          // add for Phase 4
      logout: vi.fn(),          // add for Phase 4
    }),
}))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Conditional thumbnail render (show or nothing) | Ternary: show image or placeholder div | Phase 4 | All games show something during comparison |
| Rank display: `#N of M` | Rank display: `#N` only | Phase 4 | Cleaner card layout |
| Entry form triggers "Continue?" prompt | Auto-resume on matching username | Phase 4 | Fewer clicks for returning users |
| Standalone Sync/Refresh buttons in header/action bar | Hamburger menu containing both | Phase 4 | Cleaner header layout |

**Deprecated/outdated:**
- `showContinuePrompt` logic in `UsernameEntry.tsx`: Removed in Phase 4 — the auto-resume path bypasses the "Found N ranked games" prompt entirely.
- Standalone "Sync to BGG" button in `ComparisonView`'s header: Moved into hamburger menu per D-08.
- Standalone "Refresh" button in action bar: Moved into hamburger menu per D-08.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `continueSession()` in its current form is directly usable for auto-resume without modification | Architecture Patterns — Pattern 5 | Minor: may need a small tweak if `continueSession` has side effects not visible from code reading |

**All other claims in this research were verified by direct code reading of the codebase or from CONTEXT.md locked decisions.**

## Open Questions

1. **Logout action: does it also need to cancel any in-flight sync?**
   - What we know: `cancelSync()` sets `sessionId=null` to abort the `startSync` loop; `logout()` also clears `sessionId`.
   - What's unclear: Should `logout()` call `cancelSync()` internally, or just set state directly?
   - Recommendation: Have `logout()` call `cancelSync()` first (it's idempotent and handles the timer), then additionally clear `sessionUsername` and set `view: 'entry'`. This avoids partial sync state after logout.

2. **Hamburger outside-click dismiss**
   - What we know: CONTEXT.md does not specify this behaviour.
   - What's unclear: Is it expected by the user?
   - Recommendation: Omit for MVP — the menu closes when any item is clicked. Flag in PLAN.md verification steps.

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely code/component changes with no external dependencies beyond the existing npm-installed stack. All tools are confirmed available from prior phases.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4 + @testing-library/react 16 + jsdom |
| Config file | `vitest.config.ts` — `environmentMatchGlobs: ['src/**/*.test.tsx', 'jsdom']` |
| Quick run command | `npm test -- --reporter=verbose src/components/ComparisonView.test.tsx src/store/store.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISP-01 | Thumbnail renders at h-48 with BGG link during comparison | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ Wave 0 (extend existing file) |
| DISP-01 | Gray placeholder renders when no thumbnail URL | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ Wave 0 (extend existing file) |
| DISP-02 | Amber callout renders after pick() where winner was lower-ranked | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ Wave 0 (extend existing file) |
| DISP-02 | Callout shows correct spot count (singular/plural) | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ Wave 0 (extend existing file) |
| DISP-02 | Callout does not render when lastUpset is null | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ Wave 0 (extend existing file) |
| D-03 | pick() sets lastUpset on upset; clears after timeout | unit (node) | `npm test -- src/store/store.test.ts` | ❌ Wave 0 (extend existing file) |
| D-07 | login() auto-resumes when same username + ratings/games exist | unit (node) | `npm test -- src/store/store.test.ts` | ❌ Wave 0 (extend existing file) |
| D-08 | Hamburger contains Sync (disabled when appropriate), Refresh, Logout | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ Wave 0 (extend existing file) |

### Sampling Rate
- **Per task commit:** `npm test -- src/components/ComparisonView.test.tsx src/store/store.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/ComparisonView.test.tsx` — extend with Phase 4 assertions (DISP-01, DISP-02, hamburger). File exists; add new `describe` blocks.
- [ ] `src/store/store.test.ts` — extend with `pick()` upset detection tests and `login()` auto-resume tests. File exists; add new `describe` blocks.

*(No new test files required — both test files exist and the pattern is established.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Login form already implemented (Phase 3); Phase 4 only changes flow, not credentials handling |
| V3 Session Management | no | `sessionId` still excluded from partialize; `logout()` clears it per AUTH-03 |
| V4 Access Control | no | No new routes or protected resources |
| V5 Input Validation | no | No new user inputs in this phase (login form already validates username + password) |
| V6 Cryptography | no | No cryptographic operations |

**AUTH-03 compliance check for Phase 4:** `logout()` clears `sessionId` and `sessionUsername`. `lastUpset` is session-only and never persisted. `partialize` must not change to include any new session fields. No new risk surface.

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 4 |
|-----------|-------------------|
| Integer-internal storage (`801` = 8.01) | spotsGained is a position count (integer), not a rating — no integer/float concern |
| No direct bggClient calls from UI components | `logout()` clears session state; any BGG call goes through store actions |
| partialize must exclude SessionState | `lastUpset` is session-only — must NOT appear in partialize |
| localStorage key: `bgg-ranker:v1:<slice>` | No new localStorage keys in Phase 4 |
| BGG game page link uses game.id | Confirmed: `https://boardgamegeek.com/boardgame/{game.id}` per D-06 |

## Sources

### Primary (HIGH confidence)

- `src/store/store.ts` — Full store read; timer pattern, partialize, pick(), login(), continueSession(), fetchCollection() PERSIST-02 guard [VERIFIED: codebase]
- `src/engine/rankingEngine.ts` — applyUpset position logic [VERIFIED: codebase]
- `src/components/GameCard.tsx` — Current thumbnail render, rank display [VERIFIED: codebase]
- `src/components/ComparisonView.tsx` — Current layout, existing test mock structure [VERIFIED: codebase]
- `src/components/UsernameEntry.tsx` — Current login form + continue-prompt logic [VERIFIED: codebase]
- `.planning/phases/04-display-polish/04-CONTEXT.md` — All 9 locked decisions [VERIFIED: codebase]

### Secondary (MEDIUM confidence)

None — all claims derived from direct code or locked decisions.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked from prior phases; no new packages
- Architecture: HIGH — all patterns are in-place edits to verified code
- Pitfalls: HIGH — derived from actual code behaviour (partialize, timer pattern, fetchCollection guard)
- Test patterns: HIGH — established patterns in ComparisonView.test.tsx and SyncingView.test.tsx

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable stack; 30-day window)