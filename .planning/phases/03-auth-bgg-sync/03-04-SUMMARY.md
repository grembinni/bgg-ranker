---
phase: 03-auth-bgg-sync
plan: "04"
subsystem: ui-components
tags:
  - tdd
  - sync-ui
  - syncing-view
  - comparison-view
  - app-routing
dependency_graph:
  requires:
    - "03-02 store syncProgress, syncTotal, syncStatus, reAuthAndResume, cancelSync, startSync selectors"
    - "03-03 App.tsx comment placeholder for SyncingView"
  provides:
    - "src/components/SyncingView.tsx — dedicated sync progress view with inline 401 re-auth"
    - "ComparisonView Sync to BGG button in header (always visible, disabled when no unsynced comparisons)"
    - "App.tsx SyncingView branch: {view === 'syncing' && <SyncingView />}"
  affects:
    - src/components/SyncingView.tsx
    - src/components/ComparisonView.tsx
    - src/App.tsx
    - vitest.config.ts
    - package.json
tech_stack:
  added:
    - "jsdom ^29.1.1 (devDependency) — DOM environment for React component tests"
  patterns:
    - "Component test isolation: vi.mock('../store/store') with mutable module-level variables for per-test state injection"
    - "@vitest-environment jsdom docblock — per-file environment override for component tests"
    - "vitest.config.ts: react plugin + environmentMatchGlobs for .tsx files"
    - "T-03-09: reAuthPassword in useState (local component state); never written to Zustand or localStorage"
key_files:
  created:
    - src/components/SyncingView.tsx
    - src/components/SyncingView.test.tsx
    - src/components/ComparisonView.test.tsx
    - src/test-setup.ts
  modified:
    - src/components/ComparisonView.tsx
    - src/App.tsx
    - vitest.config.ts
    - package.json
decisions:
  - "jsdom installed as devDependency (not happy-dom) — standard DOM environment for React component tests"
  - "@vitest-environment jsdom docblock used per-file to keep node environment for existing .ts tests"
  - "vitest.config.ts adds react plugin and environmentMatchGlobs for .tsx; setupFiles points to test-setup.ts importing @testing-library/jest-dom"
  - "SyncingView renders all 4 states via syncStatus switch — no state machine duplication; store owns state transitions"
  - "Sync button disabled style: opacity-50 cursor-not-allowed (matches existing Skip/Refresh disabled pattern)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 3 Plan 04: Sync UI Vertical Slice Summary

**One-liner:** SyncingView component handles all 4 syncStatus states (syncing/session-expired/error/complete) with inline 401 re-auth; ComparisonView header gains a Sync to BGG button (always visible, disabled when synced); App.tsx wires the syncing view branch — completing the full user-facing sync flow.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED-1 | Failing tests for SyncingView + test infrastructure | d36cd42 | SyncingView.test.tsx, test-setup.ts, vitest.config.ts, package.json |
| 1 | SyncingView component implementation | f3ebd2e | src/components/SyncingView.tsx, SyncingView.test.tsx |
| RED-2 | Failing tests for ComparisonView Sync button | 19e0c7f | src/components/ComparisonView.test.tsx |
| 2 | ComparisonView Sync button + App.tsx SyncingView branch | b37cbd2 | src/components/ComparisonView.tsx, src/App.tsx |

## What Was Built

### Task 1: SyncingView component

**src/components/SyncingView.tsx** — New component rendering 4 states based on `syncStatus`:

- `'syncing'`: "Syncing {progress} / {total}…" heading + Cancel button (SYNC-02)
- `'session-expired'`: paused progress label + inline form ("Session expired — re-enter your BGG password to continue.") with password input, Resume Sync button, Cancel button (D-09, T-03-09)
- `'error'`: error message + Cancel button
- `'complete'`: "Sync complete — {progress} games updated" in green text; store's `completeSyncAll` handles the 2000ms auto-return via setTimeout (D-07)

T-03-09 mitigation: `reAuthPassword` is `useState<string>('')` — local React state only, cleared on unmount, never written to Zustand or localStorage.

**Test infrastructure added:**
- `src/test-setup.ts`: imports `@testing-library/jest-dom` for component assertion matchers
- `vitest.config.ts`: adds `@vitejs/plugin-react`, `setupFiles`, `environmentMatchGlobs` for `.tsx` files
- `jsdom` installed as devDependency for DOM simulation in component tests
- `@vitest-environment jsdom` docblock in each `.test.tsx` file for per-file environment override

### Task 2: ComparisonView Sync button + App.tsx SyncingView branch

**src/components/ComparisonView.tsx** — Extended header with Sync to BGG button:
- Added selectors: `comparisonsAtLastSync`, `startSync`
- Button always rendered (never conditionally hidden — D-08)
- `disabled={comparisonsTotal === comparisonsAtLastSync}` — grayed out when no new comparisons since last sync
- `disabled` style: `opacity-50 cursor-not-allowed` (matches existing button pattern)

**src/App.tsx** — Replaced comment placeholder with real SyncingView branch:
- Added `import SyncingView from './components/SyncingView'`
- Replaced `{/* {view === 'syncing' && <SyncingView />} — added in plan 03-04 */}` with `{view === 'syncing' && <SyncingView />}`

## Test Results

```
Test Files  5 passed (5)
     Tests  124 passed (124)
    Errors  3 errors (pre-existing unhandled rejections in bggClient.test.ts — unchanged)
```

+17 new tests (12 SyncingView + 5 ComparisonView Sync button). All 107 pre-existing tests remain green.
TypeScript: `npx tsc --noEmit` exits 0.

## Deviations from Plan

### Auto-added: React component testing infrastructure (Rule 2 — missing critical functionality)

**Found during:** Task 1 (RED phase — SyncingView.test.tsx couldn't run)
**Issue:** The existing `vitest.config.ts` only included `*.test.ts` files and used `environment: 'node'`. The TDD requirement for React component tests requires `jsdom` (DOM environment) and `.tsx` test file support.
**Fix:**
- Installed `jsdom` devDependency
- Updated `vitest.config.ts`: added `@vitejs/plugin-react` plugin, updated `include` to add `src/**/*.test.tsx`, added `environmentMatchGlobs` for `.tsx` → `jsdom`, added `setupFiles` pointing to `src/test-setup.ts`
- Created `src/test-setup.ts` to import `@testing-library/jest-dom`
- Added `@vitest-environment jsdom` docblock to each `.test.tsx` file for reliable per-file environment assignment
**Files modified:** vitest.config.ts, package.json, src/test-setup.ts
**Commit:** d36cd42

## Threat Model Coverage

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-03-09 (reAuthPassword in local React state) | MITIGATED — `reAuthPassword` is `useState` local to `SyncingView`; cleared on unmount; never written to Zustand or localStorage |
| T-03-10 (startSync disabled check UI-only) | ACCEPTED — disabled state is UI guard only; store's `startSync` action reads `sessionId` defensively at loop entry |
| T-03-11 (sync button double-click DoS) | ACCEPTED — `startSync` checks `sessionId` per iteration; second call returns early if already syncing |
| T-03-SC (no new npm installs in plan) | NOTE — jsdom installed as devDependency for test infrastructure; this is a test-only dependency, not a runtime/production risk |

## Stub Scan

No stubs. All data flows are wired:
- `SyncingView` reads live store state (`syncStatus`, `syncProgress`, `syncTotal`) — no hardcoded values
- `ComparisonView` Sync button calls real `startSync()` store action
- `App.tsx` renders `SyncingView` via real view state machine
- The full sync flow is operational: UsernameEntry → login (03-03) → comparison with Sync button → startSync → SyncingView progress → (cancelSync / reAuthAndResume / completeSyncAll → auto-return)

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are UI/component layer only.

## Self-Check: PASSED

- [x] `src/components/SyncingView.tsx` — exists; contains `syncStatus`, `syncProgress`, `syncTotal`, `cancelSync`, `reAuthAndResume`, `useState` for reAuthPassword
- [x] `src/components/ComparisonView.tsx` — contains `startSync`, `comparisonsAtLastSync`, `Sync to BGG` button text, `disabled={comparisonsTotal === comparisonsAtLastSync}`
- [x] `src/App.tsx` — imports `SyncingView`; contains `{view === 'syncing' && <SyncingView />}` (no comment wrapper)
- [x] Commit d36cd42 exists (RED: SyncingView tests + infra)
- [x] Commit f3ebd2e exists (GREEN: SyncingView implementation)
- [x] Commit 19e0c7f exists (RED: ComparisonView tests)
- [x] Commit b37cbd2 exists (GREEN: ComparisonView + App.tsx)
- [x] All 124 tests pass; 0 test failures
- [x] `npx tsc --noEmit` exits 0
