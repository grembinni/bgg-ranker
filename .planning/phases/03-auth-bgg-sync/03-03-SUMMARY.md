---
phase: 03-auth-bgg-sync
plan: "03"
subsystem: ui-components
tags:
  - auth
  - ui
  - form
  - beforeunload
dependency_graph:
  requires:
    - "03-02 store login action, comparisonsTotal, comparisonsAtLastSync selectors"
  provides:
    - "UsernameEntry password field (id=bgg-password, type=password)"
    - "UsernameEntry wired to store login() action instead of fetchCollection"
    - "App.tsx beforeunload guard for unsynced comparisons"
    - "App.tsx syncing view comment placeholder for 03-04"
  affects:
    - src/components/UsernameEntry.tsx
    - src/App.tsx
tech_stack:
  added: []
  patterns:
    - "Dual-field form validation: validate both fields before any action call"
    - "beforeunload useEffect with unconditional cleanup (no memory leak)"
    - "Store action boundary: login() called from component; never bggClient directly"
key_files:
  created: []
  modified:
    - src/components/UsernameEntry.tsx
    - src/App.tsx
decisions:
  - "Password state kept in local React state (useState), never in Zustand store — satisfies T-03-06"
  - "Both username and password validated independently; both errors shown before any action call"
  - "beforeunload handler cleanup removes listener unconditionally (not gated on comparisonsTotal)"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 3 Plan 03: Auth UI Vertical Slice Summary

**One-liner:** UsernameEntry grows a password field wired to the store login() action; App.tsx adds a beforeunload guard that fires when unsynced comparisons exist.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | UsernameEntry — password field and login() wiring | 79b0a39 | src/components/UsernameEntry.tsx |
| 2 | App.tsx — beforeunload guard (AUTH-02) | 3cbd756 | src/App.tsx |

## What Was Built

### Task 1: UsernameEntry — password field + login() wiring

**src/components/UsernameEntry.tsx** — Extended without restructuring:
- Added `password` state (`useState<string>('')`) and `passwordError` state (`useState<string | null>(null)`)
- Replaced `fetchCollection` selector with `login` selector from store
- Updated `handleSubmit` to validate both fields independently: empty username shows "Username is required.", empty password shows "Password is required."; both errors can display simultaneously; only calls `login(username, password)` when both pass
- Added `<label htmlFor="bgg-password">BGG Password</label>` and `<input id="bgg-password" type="password" autoComplete="current-password">` after the username field
- Border turns `border-red-400` on each field independently when its error is set
- Updated description paragraph to: "Enter your BGG username and password to load your collection and enable sync." (D-01 form copy, Q6)
- Continue-prompt (Found N ranked games) remains below the form unchanged (D-04: full form required on return visits; prompt informs but does not bypass login)

### Task 2: App.tsx — beforeunload guard

**src/App.tsx** — Extended without touching view branches:
- Added `useEffect` import (named import alongside existing imports)
- Added `comparisonsTotal` and `comparisonsAtLastSync` selectors from store
- Added `useEffect` with `handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }` — uses `returnValue=''` per RESEARCH.md Pattern 4 (not `return 'message'` which is deprecated)
- Effect adds listener only when `comparisonsTotal > comparisonsAtLastSync` (D-12 predicate)
- Cleanup removes listener unconditionally regardless of predicate value (prevents listener accumulation across re-renders)
- Dependencies: `[comparisonsTotal, comparisonsAtLastSync]`
- Added comment placeholder: `{/* {view === 'syncing' && <SyncingView />} — added in plan 03-04 */}` — SyncingView does not exist yet; no import added

## Test Results

```
Test Files  3 passed (3)
     Tests  107 passed (107)
    Errors  3 errors (pre-existing unhandled rejections in bggClient.test.ts — unchanged)
```

All 107 tests pass. TypeScript: `npx tsc --noEmit` exits 0.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-03-06 (password in local React state, not Zustand) | MITIGATED — `password` is `useState` local to `UsernameEntry`; cleared on unmount; never written to store or localStorage |
| T-03-07 (autocomplete=current-password) | ACCEPTED — standard browser behavior per threat register |
| T-03-08 (beforeunload guard tampering) | ACCEPTED — low priority per threat register |

## Stub Scan

No stubs. Both changes are fully wired:
- `UsernameEntry` calls `store.login()` which chains to `bggLogin` → `fetchCollection` (all implemented in 03-02)
- `beforeunload` guard reads live store selectors; no hardcoded values

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. All changes are UI/component layer only.

## Self-Check: PASSED

- [x] `src/components/UsernameEntry.tsx` — exists; contains `id="bgg-password"`, `type="password"`, `autoComplete="current-password"`, `login` selector, password validation
- [x] `src/App.tsx` — exists; contains `useEffect`, `beforeunload`, `comparisonsAtLastSync`, `e.returnValue = ''`
- [x] Commit 79b0a39 exists (Task 1)
- [x] Commit 3cbd756 exists (Task 2)
- [x] All 107 tests pass; 0 test failures
- [x] `npx tsc --noEmit` exits 0
