---
phase: 04-display-polish
plan: 04
subsystem: ui
tags: [react, tailwind, hamburger-menu, upset-callout, zustand, vitest]

# Dependency graph
requires:
  - phase: 04-display-polish/04-02
    provides: lastUpset field and logout() action in store (needed by ComparisonView)
  - phase: 04-display-polish/04-03
    provides: GameCard thumbnail upgrade (used within ComparisonView grid)
  - phase: 04-display-polish/04-01
    provides: RED phase failing tests for hamburger, upset callout, login auto-resume

provides:
  - ComparisonView with hamburger header (Menu button aria-label, dropdown with Sync/Refresh/Logout)
  - ComparisonView upset callout (amber bg-amber-50 row between card grid and action buttons)
  - ComparisonView action bar cleaned: standalone Refresh and Sync buttons removed
  - UsernameEntry simplified: login form only, no continue-prompt block

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useState for local UI toggle (menuOpen) — no store involvement for ephemeral menu open/close state"
    - "Hamburger handler pattern: each handler calls setMenuOpen(false) then the store action"
    - "lastUpset conditional render: {lastUpset !== null && <div>} — no reserved layout slot"

key-files:
  created: []
  modified:
    - src/components/ComparisonView.tsx
    - src/components/ComparisonView.test.tsx
    - src/components/UsernameEntry.tsx

key-decisions:
  - "Existing Sync tests updated to open hamburger first — tests remain valid and match the new UX flow"
  - "No new imports or packages required — all changes use existing React hooks and Tailwind utilities"

patterns-established:
  - "Handler-with-menu-close pattern: const handleSync = () => { setMenuOpen(false); startSync() }"

requirements-completed:
  - DISP-01
  - DISP-02

# Metrics
duration: 15min
completed: 2026-05-25
---

# Phase 4 Plan 04: ComparisonView Hamburger + Upset Callout Summary

**ComparisonView upgraded with hamburger navigation (Sync/Refresh/Logout dropdown), amber upset callout between grid and action buttons, and UsernameEntry simplified to login-form-only by removing the continue-prompt block**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-25T17:50:00Z
- **Completed:** 2026-05-25T18:10:00Z
- **Tasks:** 2 (automated) + 1 checkpoint pending human verification
- **Files modified:** 3

## Accomplishments

- Replaced the flat header (username/counter/Sync-button) with hamburger-left / counter-center / username-right layout (D-08, D-09)
- Hamburger dropdown: Sync to BGG (disabled when dirtyGameIds empty or sessionId null), Refresh rankings, Logout — each closes menu on click
- Amber upset callout rendered after card grid, before action buttons, when lastUpset !== null (D-04, D-05)
- Callout text: "[winner] moved up N spot(s)" with singular/plural handling
- Standalone Refresh button removed from action bar (now only in hamburger)
- UsernameEntry: removed continueSession, resetForNewUser, sessionUsername, rankingsUsername, ratings selectors and the showContinuePrompt/ratingsCount variables and JSX block — login form is now the only UI element
- All 20 ComparisonView tests GREEN; full 145-test suite passes; TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite ComparisonView header, add upset callout, remove standalone Refresh/Sync; update test mock and old Sync tests** - `ffa8c26` (feat)
2. **Task 2: Simplify UsernameEntry — remove continue-prompt block and unused selectors** - `5ccc59f` (feat)

**Plan metadata:** _(to be committed with SUMMARY and state updates)_

## Files Created/Modified

- `src/components/ComparisonView.tsx` - Hamburger header, upset callout row, cleaned action bar (Skip/Ranked list/Unplayed only)
- `src/components/ComparisonView.test.tsx` - Existing Sync tests updated to open hamburger first; all 20 tests GREEN
- `src/components/UsernameEntry.tsx` - 35 lines removed: 5 unused selectors, showContinuePrompt, ratingsCount, and the entire continue-prompt JSX block

## Decisions Made

- Updated the existing Sync describe block tests to open hamburger first — preserves test intent while matching the new UX where Sync to BGG lives inside the dropdown. Tests named to reflect the new location ("in the hamburger dropdown").
- No deviation from the plan's interface spec — hamburger pattern, upset callout classes, and handler patterns all match 04-PATTERNS.md exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 (Display Polish) is feature-complete pending human checkpoint visual verification
- All automated tests pass (145 tests GREEN across 5 test files)
- TypeScript compiles clean
- Human checkpoint required: visual verification of hamburger, upset callout, and auto-resume in browser at http://localhost:5173
- Phase 5 (Firebase Cloud Functions production deploy) can proceed once checkpoint is approved

## Known Stubs

None — all behavior is fully implemented and wired. lastUpset flows from store.pick() through Zustand to ComparisonView render. logout() clears session and preserves rankings. Auto-resume in login() is live from 04-02.

## Self-Check: PASSED

- src/components/ComparisonView.tsx: FOUND
- src/components/ComparisonView.test.tsx: FOUND
- src/components/UsernameEntry.tsx: FOUND
- Commit ffa8c26 (Task 1): FOUND
- Commit 5ccc59f (Task 2): FOUND
- ComparisonView.tsx contains "menuOpen": CONFIRMED
- ComparisonView.tsx contains "lastUpset": CONFIRMED
- ComparisonView.tsx contains "bg-amber-50": CONFIRMED
- ComparisonView.tsx contains aria-label "Menu": CONFIRMED
- UsernameEntry.tsx does NOT contain "showContinuePrompt": CONFIRMED
- UsernameEntry.tsx does NOT contain "ratingsCount": CONFIRMED
- UsernameEntry.tsx does NOT contain "continueSession": CONFIRMED
- All 20 ComparisonView.test.tsx tests GREEN: CONFIRMED
- Full 145-test suite GREEN: CONFIRMED
- npx tsc --noEmit exits 0: CONFIRMED

---
*Phase: 04-display-polish*
*Completed: 2026-05-25*
