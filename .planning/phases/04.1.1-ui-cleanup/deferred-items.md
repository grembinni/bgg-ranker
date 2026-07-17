# Deferred Items — Phase 04.1.1

Out-of-scope issues discovered during execution but not fixed (per executor scope boundary rules).

## Pre-existing `npx tsc -b` errors in `src/store/store.test.ts` and `src/store/store.ts`

- **Found during:** Plan 01, Task 1 verification (`npx tsc -b`)
- **Scope:** `src/store/store.test.ts` has ~15 `TS2352` errors (unsafe type assertions against `AppStore`/`SessionStateSlice`/`CollectionStateSlice` — missing properties like `sessionUsername`, `sessionId`, `lastFetched`, and `Record<string, unknown>` conversions). `src/store/store.ts:12` has a `TS6133` unused-variable error for `redistribute`.
- **Verified pre-existing:** Confirmed via `git stash` (stashing all working-tree changes including the new `Header.tsx`) — the identical error set reproduces on a clean tree, unrelated to this plan's changes.
- **Not fixed:** Out of scope per executor scope-boundary rule — these files are not touched by Plan 01 (Header.tsx / Header.test.tsx / App.tsx), and `npx vitest run` (the actual test runner) passes cleanly; `tsc -b` failures here are pre-existing type-declaration debt in `store.test.ts`, not a regression introduced by this plan.
- **Recommendation:** Address in a dedicated typing-cleanup task, not as part of UI cleanup.
