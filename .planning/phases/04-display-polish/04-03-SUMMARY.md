---
phase: 04-display-polish
plan: 03
subsystem: ui
tags: [react, tailwind, gamecards, thumbnails, bgg-link]

# Dependency graph
requires:
  - phase: 04-display-polish/04-01
    provides: RED phase failing tests for GameCard thumbnail (DISP-01) in ComparisonView.test.tsx
  - phase: 04-display-polish/04-02
    provides: store changes (lastUpset, upsetTimer, logout) needed by ComparisonView which renders GameCard
affects: [04-04]

provides:
  - GameCard.tsx with h-48 cover art image wrapped in BGG anchor link when thumbnail URL exists
  - GameCard.tsx gray placeholder div (h-48 bg-gray-100) with "No image" text when thumbnail is empty/falsy
  - GameCard.tsx rank display as "#N" only — no "of N total" suffix

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thumbnail ternary: game.thumbnail ? anchor+img : placeholder-div — replaces {game.thumbnail && <img/>} conditional"
    - "Protocol-relative URL normalization preserved inside img src: game.thumbnail.startsWith('//') ? 'https:' + game.thumbnail : game.thumbnail"
    - "External link security: target=_blank with rel=noopener noreferrer on all BGG game page anchors (T-04-05)"

key-files:
  created: []
  modified:
    - src/components/GameCard.tsx

key-decisions:
  - "aspect-square added to both img and placeholder div for consistent 192px square card sizing"
  - "totalGames variable removed (was only used for rank display suffix, now unused)"
  - "ratings selector remains (still needed for getRankPosition call)"

patterns-established:
  - "GameCard thumbnail ternary: show anchor+img or gray placeholder — no reserved layout slot when absent"

requirements-completed:
  - DISP-01

# Metrics
duration: 6min
completed: 2026-05-25
---

# Phase 4 Plan 03: GameCard Thumbnail Upgrade Summary

**GameCard upgraded to 192px cover art in a BGG page anchor, gray "No image" placeholder, and hash-only rank display — DISP-01 GREEN**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-25T21:07:06Z
- **Completed:** 2026-05-25T21:13:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced `{game.thumbnail && <img h-32>}` conditional with ternary: `{game.thumbnail ? <a><img h-48></a> : <div placeholder>}`
- Image now 192px tall (`h-48`) with `object-contain aspect-square` for consistent square card sizing
- Thumbnail image wrapped in anchor linking to `https://boardgamegeek.com/boardgame/{game.id}` with `target="_blank" rel="noopener noreferrer"` (mitigates T-04-05 tab-napping)
- Gray placeholder div (`h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm aspect-square`) renders "No image" text when thumbnail is empty/falsy
- Removed `const totalGames = ...` and `"of {totalGames}"` suffix — rank now displays as `#N` only
- All 3 ComparisonView.test.tsx `GameCard thumbnail (DISP-01)` tests now GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade GameCard thumbnail, link, placeholder, and rank display** - `a1577ff` (feat)

**Plan metadata:** _(to be committed with SUMMARY and state updates)_

## Files Created/Modified

- `src/components/GameCard.tsx` - h-48 thumbnail ternary with BGG link, gray placeholder, hash-only rank

## Decisions Made

- No new imports needed — all changes use existing JSX primitives and Tailwind classes
- `ratings` selector kept (still consumed by `getRankPosition`); only `totalGames` derivation removed
- Pre-existing Vitest cache corruption (`results.json` cached all 5 test suites as failed) was cleared before running tests; root cause: stale cache from a prior session. Not a code issue.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest cache (`node_modules/.vite/vitest/.../results.json`) contained stale failure records from a prior session, causing all test suites to appear broken before any tests actually ran. Cleared the cache directory, confirmed tests pass. No code change required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DISP-01 (cover art) fully implemented and tested GREEN
- 04-04 can implement the upset callout rendering in ComparisonView and the hamburger menu (store logic already in place from 04-02)
- TypeScript compiles clean; no regressions in any previously-passing tests

---
*Phase: 04-display-polish*
*Completed: 2026-05-25*
