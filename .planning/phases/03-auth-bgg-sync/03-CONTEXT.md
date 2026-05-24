# Phase 3: Auth & BGG Sync - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

User adds their BGG password alongside their username to authenticate a BGG session, then can push all local rankings to BGG as star ratings. Sync shows live progress, resumes after interruption (page reload or session expiry), and the browser warns before tab close when unsynced comparisons exist.

**Phase 3 ends when:**
- User enters username + password in a single form; app authenticates with BGG, then fetches collection — sequential auth-then-fetch
- "Sync to BGG" button appears in the comparison screen header; disabled when no unsynced comparisons exist
- Sync transitions to a dedicated 'syncing' view showing "Syncing N / total…" with throttle between writes
- If BGG returns 401 mid-sync, the syncing view shows an inline password re-entry form; after re-auth, sync resumes from last successful write
- If sync is interrupted by page reload, resume anchored on a persisted set of already-synced game IDs (skips re-sending those on next sync)
- On successful sync: auto-return to comparison screen with a brief confirmation message
- On tab close with unsynced comparisons: browser `beforeunload` warning fires

**Phase 3 does NOT include:**
- Display polish / cover art (Phase 4)
- Firebase production deploy (Phase 5)
- Collection reconciliation on return visit (v2)

</domain>

<decisions>
## Implementation Decisions

### Auth UI
- **D-01:** Password field appears **upfront with username** in the existing `UsernameEntry` form. Single form, single submit. No separate auth step or new view. The form grows one field.
- **D-02:** On submit: **auth first, then fetch**. POST credentials → receive `sessionId` → fetch collection. Sequential. If login fails, user sees an auth error before any collection work starts.
- **D-03:** Loading screen shows **two sequential messages** reusing the existing `CollectionLoading` component: first "Logging in to BGG…", then "Fetching your games…" (via the existing `loadingMessage` store field).
- **D-04:** On return visits: **full form required** — username + password every time. Upholds AUTH-03 and existing D-08 (no username persistence). The "Found N ranked games" continue-prompt from Phase 2 still appears below the form; continuing a session still requires re-entering credentials before the sync button activates.

### Sync UI & Progress
- **D-05:** "Sync to BGG" button lives in the **comparison screen header**, alongside username and comparison counter.
- **D-06:** Sync progress uses a **dedicated `'syncing'` view state**. App.tsx adds a `{view === 'syncing' && <SyncingView />}` branch. Ranking is paused while sync runs.
- **D-07:** On successful sync completion: **auto-return to comparison screen** after showing "Sync complete — N games updated" for ~2 seconds. No extra user action needed.
- **D-08:** Sync button is **disabled (grayed out) when 0 unsynced comparisons exist** (`comparisonsTotal === comparisonsAtLastSync`). Always visible — user can see the button and understand why it's inactive.

### Mid-Sync 401 Handling
- **D-09:** When BGG returns 401 mid-sync, the **`SyncingView` shows an inline re-auth form** (password field + submit). No view transition. Progress count is visible; sync is paused. Clear copy: "Session expired — re-enter your BGG password to continue."
- **D-10:** After user submits new password: **silently re-authenticate** (new `sessionId`), then **resume sync from last successful write** — the progress counter continues from where it stopped, not from zero.
- **D-11:** Sync resume anchor is a **persisted `syncedGameIds: string[]`** in the store (RankingsStateSlice, included in `partialize`). On sync start, skip any game ID already in this set. Clear `syncedGameIds` and update `comparisonsAtLastSync` after sync fully completes. This handles both 401 interruption and page-reload interruption (SYNC-03).
- **D-12:** "Unsaved changes" for `beforeunload` guard: **`comparisonsTotal > comparisonsAtLastSync`**. Store tracks `comparisonsAtLastSync: number` (persisted). Resets to `comparisonsTotal` after each successful sync. If `comparisonsAtLastSync` is 0 and `comparisonsTotal` > 0 on a fresh session, guard fires correctly.

### Store Shape Changes (Phase 3 additions)
- **D-13:** Add to `SessionStateSlice` (ephemeral, excluded from `partialize`): `sessionId: string | null`. Never written to localStorage — AUTH-03.
- **D-14:** Add to `RankingsStateSlice` (persisted): `syncedGameIds: string[]`, `comparisonsAtLastSync: number`.
- **D-15:** New view state added to the `view` union type: `'syncing'`.
- **D-16:** New store actions: `login(username, password)`, `startSync()`, `markGameSynced(gameId)`, `completeSyncAll()`, `reAuthAndResume(password)`, `cancelSync()`.

### bggClient Additions
- **D-17:** Add `bggLogin(username: string, password: string): Promise<{ sessionId: string }>`. POSTs credentials to BGG login endpoint through proxy. Extracts `sessionId` from response JSON body (per Phase 1 D-07 pattern).
- **D-18:** Add `bggRateGame(gameId: string, ratingInt: number, sessionId: string): Promise<void>`. Sends `X-BGG-Session` header (per Phase 1 D-08). Throws on non-2xx. Caller interprets 401 as session-expired signal.

### Claude's Discretion
- BGG login endpoint exact URL and POST body format — Claude implements based on PITFALLS.md and smoke-test-dev.sh knowledge
- Throttle implementation between writes — 200–500ms random delay per SYNC-02; Claude picks approach
- Exact success message duration before auto-return (~2 seconds) — Claude decides
- SyncingView cancel behavior — Claude decides whether cancel mid-sync clears `syncedGameIds` or preserves them for resume

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 3 implements AUTH-01, AUTH-02, AUTH-03, SYNC-01, SYNC-02, SYNC-03
- `.planning/ROADMAP.md` — Phase 3 success criteria (5 numbered items)

### Architecture & Patterns
- `.planning/research/ARCHITECTURE.md` — Zustand slice interfaces, localStorage schema, `partialize` rules, "UI components never call bggClient directly"
- `.planning/research/PITFALLS.md` — C2 (cookie handling / session token extraction), C3 (BGG write endpoint undocumented) — critical for `bggLogin` and `bggRateGame` implementation

### Phase 1 Decisions (carry forward)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-07 (sessionId as JSON body from proxy), D-08 (X-BGG-Session header for writes), D-10 (integer-internal storage — divide by 100 only at sync time)

### Phase 2 Decisions (carry forward)
- `.planning/phases/02-collection-ranking/02-CONTEXT.md` — D-08 (no username persistence), D-09 (PersistedRankings username guard), D-10 (continue-or-refetch prompt)

### Existing Implementation
- `src/api/bggClient.ts` — Add `bggLogin` and `bggRateGame` here. `BGG_API_BASE` already wired. `poll202Loop` already available. Never import bggClient in components.
- `src/store/store.ts` — Full store implementation. Extend `SessionStateSlice` (add `sessionId`), `RankingsStateSlice` (add `syncedGameIds`, `comparisonsAtLastSync`), `view` union type (add `'syncing'`), and `AppActions` (add auth + sync actions).
- `src/components/UsernameEntry.tsx` — Add password field to existing form. Call new `login` store action.
- `src/components/ComparisonView.tsx` — Add "Sync to BGG" button to header, wired to `startSync` action.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/CollectionLoading.tsx` — Reuse for auth+fetch loading messages (two sequential messages via `loadingMessage` store field)
- `src/components/ErrorDisplay.tsx` — Reuse for auth failures (wrong password, login error)
- `src/store/store.ts:createAppStore` — Factory pattern; extend existing slices — do not restructure
- `src/api/bggClient.ts:poll202Loop` — Pattern for async BGG HTTP calls; follow same error-handling conventions

### Established Patterns
- **Integer-internal ratings:** `ratingInt / 100` only when calling `bggRateGame` — never stored as float
- **Ephemeral session state:** `sessionId` follows same pattern as `sessionUsername` — excluded from `partialize`
- **Auth-03 partialize block:** Current `partialize` already excludes `sessionUsername`; `sessionId` must also be excluded
- **View state machine:** `App.tsx` switches on `view` string — add `'syncing'` branch without touching other branches
- **Tailwind v4:** No config file. Use utility classes directly in `SyncingView.tsx`.

### Integration Points
- `App.tsx` — Add `{view === 'syncing' && <SyncingView />}` branch
- `ComparisonView.tsx` header — Add Sync button alongside existing username/counter row
- `store.ts partialize` — Add `syncedGameIds` and `comparisonsAtLastSync` to persisted fields; keep `sessionId` out
- `bggClient.ts` — New exports: `bggLogin`, `bggRateGame`

</code_context>

<specifics>
## Specific Ideas

- Sync button disabled state copy: the button label can stay "Sync to BGG" when disabled; no need for a separate "Up to date" label
- `SyncingView` inline re-auth: password field replaces the progress bar when 401 fires; same component, conditional render based on sync store state
- `comparisonsAtLastSync` initialized to `comparisonsTotal` on first sync start — so if user syncs immediately without any new comparisons, button stays disabled correctly

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 3 scope.

</deferred>

---

*Phase: 3-Auth-BGG-Sync*
*Context gathered: 2026-05-24*
