# Phase 4: Display Polish — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers two visual enhancements to the comparison screen and a full login/navigation overhaul:

1. **DISP-01 (Cover Art):** Thumbnails already render in GameCard — this phase upgrades the card layout: h-48 square image with a link to the BGG game page, gray placeholder for missing thumbnails, rank displayed as `#N` only (no total count).

2. **DISP-02 (Upset Callout):** After any comparison where the winner was ranked lower than the loser, show an amber callout `"[Game] moved up N spots"` between the cards and action buttons. Auto-clears after 5 seconds.

3. **Login/Nav overhaul:** Entry view becomes a full login form (username + password, always). Session established upfront. Returning users with stored rankings auto-resume — no "Continue session?" prompt. Hamburger menu (top-left) replaces standalone Sync/Refresh buttons in the header. Header layout: `[☰] | [counter] | [username]`.

**Phase 4 does NOT include:**
- Firebase production deploy (Phase 5)
- Full ranked list view (deferred to v2)
- Any new comparison algorithm changes

</domain>

<decisions>
## Implementation Decisions

### D-01: Upset trigger
Fire the callout on **any upset** — whenever the chosen winner was ranked lower than the loser (`winnerPos > loserPos` in `applyUpset`). No minimum position threshold.

### D-02: Upset callout text
Format: `"[Game name] moved up N spots"` (winner's name + positions gained). Handle singular: `"1 spot"` vs `"3 spots"`.

### D-03: Upset callout timing
Auto-clear after **5 seconds** using a `setTimeout`. The callout state is session-only (not persisted). Stored as `lastUpset: { winnerName: string; spotsGained: number } | null` in `ComparisonStateSlice`.

The `pick` action must:
1. Compute `winnerPos` and `loserPos` from the pre-upset rankings.
2. If `loserPos > winnerPos` (upset occurred), set `lastUpset` with name + spots gained.
3. Schedule a 5s timeout to clear `lastUpset` (cancel any previous timer first).

### D-04: Callout placement
Full-width row between the 2-column card grid and the Skip/Refresh/etc. action buttons. Hidden when `lastUpset` is null — no layout shift caused by a reserved slot.

### D-05: Callout visual style
Amber: `bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-2 text-center text-sm`.

### D-06: GameCard thumbnail upgrade
- Image height: `h-48` (192px), `object-contain`, `aspect-square`
- Image wrapped in `<a href="https://boardgamegeek.com/boardgame/{game.id}" target="_blank" rel="noopener noreferrer">`
- Missing thumbnail (no URL): gray placeholder box — `h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm` with "No image" text or icon
- Rank display: drop `"of N total"`, show only `"#{rank}"`

### D-07: Login flow — always username + password
Replace the username-only entry form with a full login form:
- Collect `username` + `password`
- Call `login(username, password)` upfront (same `bggLogin` call, establishes `sessionId`)
- After successful login:
  - If `rankingsUsername === username` AND stored ratings/games exist → auto-resume (skip fetch, go to comparison view)
  - Otherwise → call `fetchCollection(username)` as before
- Remove the "Continue session?" vs "Refetch?" prompt — auto-resume is the only behavior for returning same user

### D-08: Hamburger navigation
- Location: top-left of comparison header
- Icon: `☰` (three-line hamburger) as a button
- Dropdown contains: **Sync to BGG**, **Refresh rankings**, **Logout**
- **Sync to BGG**: same as current `startSync()` action; show as disabled when `dirtyGameIds.length === 0 || !sessionId`
- **Refresh rankings**: calls `refresh()` — same as current Refresh button
- **Logout**: clears session (`sessionId`, `sessionUsername`), returns to entry/login view. Does NOT clear stored rankings (a re-login with the same username will auto-resume).
- Remove standalone Refresh button and Sync to BGG button from the action bar and header

### D-09: Header layout
New comparison header: `[☰ hamburger]    [N this session · N total]    [username]`
(hamburger top-left, counter centered, username right — flex justify-between)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria (DISP-01, DISP-02)
- `.planning/REQUIREMENTS.md` — DISP-01, DISP-02 requirement definitions

### Existing Implementation (read before modifying)
- `src/components/GameCard.tsx` — Current card layout; thumbnail already renders at h-32
- `src/components/ComparisonView.tsx` — Current comparison screen; header, card grid, action buttons
- `src/store/store.ts` — Full store: ComparisonStateSlice (add `lastUpset`), `pick` action (add upset detection), `login`/`fetchCollection` flow, `continueSession`
- `src/engine/rankingEngine.ts` — `applyUpset` logic; winnerPos/loserPos computation pattern

### CLAUDE.md Constraints
- `CLAUDE.md` — Integer-internal ratings, no direct bggClient calls from UI, partialize must exclude SessionState

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GameCard.tsx`: Already has thumbnail img, rank display, pick/unplayed buttons. Upgrade in-place.
- `ComparisonView.tsx`: Header flex row, 2-column grid, action button row at bottom. Add hamburger to header; inject callout row between grid and buttons.
- `store.ts` `pick()`: Already computes `applyUpset` and diffs old vs new ratings for dirty tracking — extend to capture `winnerPos`/`loserPos` for upset detection.
- `store.ts` `login()`: Existing action that calls `bggLogin` — already establishes `sessionId`. Entry flow just needs to call it first.

### Established Patterns
- Zustand session-only state: `ComparisonStateSlice` fields like `syncStatus` are not in `partialize`. `lastUpset` follows same pattern — session-only, not persisted.
- Tailwind utility classes throughout; no component library. New elements follow existing `rounded border px-4 py-2` patterns.
- `{game.thumbnail && (<img .../>)}` conditional render pattern in GameCard — replace with `{game.thumbnail ? <img/> : <placeholder/>}`.

### Integration Points
- `pick()` in `store.ts`: Extend to set `lastUpset` and schedule a 5s clear. Need a module-level `upsetTimer` ref (mirrors `completeSyncTimer` pattern).
- `continueSession()` / `fetchCollection()` in `store.ts`: `continueSession` becomes the internal path for auto-resume; login action orchestrates the decision.
- Entry view in `App.tsx` or dedicated component: Replace username-only form with username+password form.

</code_context>

<specifics>
## Specific Ideas

- BGG game page link: `https://boardgamegeek.com/boardgame/{game.id}` (open in new tab)
- Hamburger icon: `☰` character or equivalent SVG — matches text-only button style in rest of app
- Logout does NOT wipe stored rankings — intentional, so re-login auto-resumes
- `lastUpset` cleared by 5s timeout AND also by the next `pick()` call if the timer fires first (idempotent clear)
- `applyUpset` already guards `winnerPos > loserPos` — upset detection reuses same comparison

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Display Polish*
*Context gathered: 2026-05-25*
