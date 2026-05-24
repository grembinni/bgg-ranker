---
phase: 2
plan: 03
subsystem: comparison-ui
tags: [react, tailwind, zustand, comparison-loop, game-card, vertical-slice]
dependency_graph:
  requires:
    - 02-02 (store actions pick/skip/refresh, App.tsx ComparisonPlaceholder)
    - 02-01 (Wave 0 store tests, engine)
  provides:
    - src/components/GameCard.tsx (per-card render with name, year, rank, Pick button)
    - src/components/ComparisonView.tsx (View 3 with header, cards, Skip/Refresh)
    - src/App.tsx (ComparisonPlaceholder replaced with ComparisonView)
  affects:
    - Phase 2 complete — all 6 ROADMAP success criteria satisfied
tech_stack:
  added: []
  patterns:
    - Module-level getRankPosition pure helper (avoids re-allocation on every render)
    - One selector per value useStore pattern (no whole-store spread)
    - Defensive null guard for currentPair render edge case
    - U+00B7 middle dot for combined counter display per UI-SPEC copywriting contract
key_files:
  created:
    - src/components/GameCard.tsx
    - src/components/ComparisonView.tsx
  modified:
    - src/App.tsx
decisions:
  - getRankPosition defined at module scope (not inside component) to avoid re-allocation per render
  - ComparisonView reads pick/skip/refresh as store selectors (not via useStore.getState()) for consistent Zustand pattern
  - App.tsx uses default import for ComparisonView (matches existing component import style)
metrics:
  duration: "~10 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 2 Plan 03: Vertical Slice — Comparison Loop UI (Pick, Skip, Refresh, Counter, Persistence) Summary

Two React components (GameCard, ComparisonView) completing the Phase 2 vertical slice: comparison loop with pick/skip/refresh wired to the store, rank position display, combined session/total counter, and ComparisonPlaceholder replaced in App.tsx.

## What Was Built

### Task 1 — `src/components/GameCard.tsx` (36 lines)

Per-card render component for the comparison screen:

- **`getRankPosition`**: Module-scope pure helper; sorts `Object.entries(ratings)` descending and returns 1-indexed position. Defined above the component to avoid re-allocation per render.
- **Null guard**: Returns `null` when `game === undefined` (defensive guard for render transition edge case when `redistribute` temporarily clears `currentPair`).
- **Layout**: Card container `bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-2` per UI-SPEC §View 3.
- **Game name**: `text-xl font-semibold text-gray-900 leading-tight` (Heading typography per UI-SPEC).
- **Year**: `({game.yearPublished})` — parentheses part of rendered text per UI-SPEC §Copywriting Contract.
- **Rank**: `#{rank} of {totalGames}` — exact format per UI-SPEC §Copywriting Contract.
- **Pick button**: `mt-auto w-full min-h-[44px] bg-blue-600 text-white ...` with hover/active/focus/disabled states; `min-h-[44px]` satisfies WCAG 2.5.5.
- **No thumbnail**: D-07 deferred — no `<img>` element in component.
- **No bggClient import**: UI architecture rule maintained.

### Task 2 — `src/components/ComparisonView.tsx` (52 lines) + `src/App.tsx` update

View 3 comparison screen and App.tsx router update:

- **Store reads**: One selector per value — `currentPair`, `sessionComparisons`, `comparisonsTotal`, `sessionUsername`, `pick`, `skip`, `refresh`.
- **Null guard**: Empty state `<p>No pair available...</p>` when `currentPair === null`.
- **Header**: `flex justify-between items-center mb-8 text-base text-gray-700`; left: `{sessionUsername}`; right: `{sessionComparisons} this session · {comparisonsTotal} total` with U+00B7 MIDDLE DOT per UI-SPEC §Copywriting Contract.
- **Cards row**: `grid grid-cols-2 gap-6` with two `<GameCard>` instances; `onPick={() => pick(leftId, rightId)}` and `onPick={() => pick(rightId, leftId)}` — correct winner/loser wiring.
- **Actions row**: `flex gap-4 justify-center mt-8`; Skip wired to `skip()`, Refresh wired to `refresh()`; both with secondary button class string.
- **App.tsx**: Removes `ComparisonPlaceholder` function component; adds `import ComparisonView from './components/ComparisonView'`; renders `<ComparisonView />` for `view === 'comparison'`.

## Verification Results

- `tsc --noEmit`: exits 0
- `npm test`: 78/78 pass (all Wave 0 store + bggClient + engine tests GREEN; no regressions)
- `npm run build`: exits 0 (bundle 251 KB)
- `grep -c "img" src/components/GameCard.tsx`: 0 (no thumbnail rendering)
- `grep -F "Pick this game" src/components/GameCard.tsx`: match found
- `grep -F "this session · " src/components/ComparisonView.tsx`: match found (U+00B7 present)
- `grep -F "ComparisonPlaceholder" src/App.tsx`: no matches
- `grep -rE "from '.*api/bggClient'" src/components/`: no matches

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data flows from the Zustand store through live selectors. No hardcoded values, no placeholder text, no unconnected props.

## Threat Flags

None. This plan adds only React render components consuming existing store state. No new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- `src/components/GameCard.tsx` — FOUND (36 lines, > 30 minimum)
- `src/components/ComparisonView.tsx` — FOUND (52 lines, > 40 minimum)
- `src/App.tsx` — FOUND (19 lines, > 15 minimum, contains `<ComparisonView />`)
- Commit `f918f26` — GameCard component
- Commit `0620a88` — ComparisonView + App.tsx update
- All 78 tests — PASSING
- `npm run build` — PASSES (0 TypeScript errors, Vite bundle 251 KB)
