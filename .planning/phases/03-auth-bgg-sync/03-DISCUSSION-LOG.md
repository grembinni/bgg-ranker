# Phase 3: Auth & BGG Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 3-auth-bgg-sync
**Areas discussed:** Auth UI placement, Sync UI & progress display, Mid-sync 401 handling

---

## Auth UI Placement

### Q1: Where should the password field appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Upfront with username | Single form: username + password together. Simpler state machine — one submit covers auth + fetch. | ✓ |
| Secondary step on comparison screen | Username-only form first (collection loads without auth). 'Connect to BGG' panel appears later. | |
| Dedicated Login view | New 'login' view before 'entry'. Separate concerns but adds a view. | |

**User's choice:** Upfront with username (Recommended)

---

### Q2: When the form is submitted, what happens first?

| Option | Description | Selected |
|--------|-------------|----------|
| Auth then fetch | POST credentials → get sessionId → fetch collection. If login fails, error before any collection work. | ✓ |
| Fetch and auth in parallel | Saves a round-trip but complex error handling if one fails. | |
| Fetch first, auth after | User reaches comparison screen faster but Sync availability delayed. | |

**User's choice:** Auth then fetch (Recommended)

---

### Q3: What does the loading screen show?

| Option | Description | Selected |
|--------|-------------|----------|
| Two sequential messages | "Logging in to BGG…" then "Fetching your games…". Reuses CollectionLoading with different messages. | ✓ |
| Single combined message | "Loading your collection…" covers both. Simpler but user can't tell where it's slow. | |
| Progress steps display | Explicit 1-of-2 / 2-of-2. More informative but more build work. | |

**User's choice:** Two sequential messages (Recommended)

---

### Q4: On return visits, what does the entry form show?

| Option | Description | Selected |
|--------|-------------|----------|
| Full form: username + password required | Consistent with AUTH-03 and D-08. "Found N games" prompt still appears below. | ✓ |
| Username pre-filled, password required | Would require reversing D-08 (no username persistence). | |
| You decide | Claude picks based on AUTH-03. | |

**User's choice:** Full form: username + password required (Recommended)

---

## Sync UI & Progress Display

### Q1: Where does 'Sync to BGG' live?

| Option | Description | Selected |
|--------|-------------|----------|
| Header area | In the comparison header alongside username and counter. Always visible. | ✓ |
| Below Skip/Refresh buttons | Third button in footer. Mixes ranking actions with data-write action. | |
| Floating action button | Bottom-right. Prominent but a new UI pattern. | |

**User's choice:** Header area (Recommended)

---

### Q2: How is sync progress shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 'syncing' view | New view state. Ranking pauses. Clean separation; 401 prompt handled in same view. | ✓ |
| Inline progress in comparison screen | Background sync with header progress. Ranking continues. More complex state. | |
| Full-page overlay / modal | Blocks ranking but doesn't change view state. Middle ground. | |

**User's choice:** Dedicated 'syncing' view (Recommended)

---

### Q3: What happens when sync completes successfully?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-return to comparison with confirmation | "Sync complete — N games updated" briefly, then auto-return. No extra click. | ✓ |
| Stay on syncing view until dismissed | Shows completion + "Back to ranking" button. One extra tap. | |
| You decide | Claude picks transition behavior. | |

**User's choice:** Auto-return to comparison with confirmation (Recommended)

---

### Q4: Sync button disabled or hidden when nothing to sync?

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled (grayed out) | Always visible, disabled when 0 unsynced comparisons. User understands why. | ✓ |
| Always enabled | Simpler — a sync with no changes just re-writes same ratings. | |
| Hidden until unsynced changes exist | Cleanest header but button appearance feels sudden. | |

**User's choice:** Disabled (grayed out) when nothing to sync (Recommended)

---

## Mid-Sync 401 Handling

### Q1: When 401 fires mid-sync, what does the user see?

| Option | Description | Selected |
|--------|-------------|----------|
| Syncing view shows inline re-auth form | Progress pauses, password field appears in same view. "Session expired — re-enter your BGG password to continue." | ✓ |
| Transition to 'session expired' view | Dedicated view in state machine. Cleaner separation but adds a view. | |
| Modal overlay on syncing view | Modal covers syncing view with re-auth form. New UI pattern not used elsewhere. | |

**User's choice:** Syncing view shows inline re-auth form (Recommended)

---

### Q2: After re-entering password, what does sync do?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-authenticate silently, resume from last successful write | New sessionId, continue from where stopped. Progress counter continues, not restarts. | ✓ |
| Re-authenticate, restart sync from beginning | Simpler but re-sends already-synced ratings (harmless, just slower). | |

**User's choice:** Re-authenticate silently, then resume from last successful write (Recommended)

---

### Q3: What is the sync resume anchor?

| Option | Description | Selected |
|--------|-------------|----------|
| Persisted set of synced game IDs | `syncedGameIds: string[]`. On resume, skip IDs in set. Clear after full sync. Handles both 401 and page-reload (SYNC-03). | ✓ |
| lastSyncedIndex in sorted array | Integer index. Simpler but fragile if sort order changes between sessions. | |
| You decide | Claude picks anchor mechanism. | |

**User's choice:** lastSyncedAt timestamp + sorted ratings snapshot (persisted `syncedGameIds` set) (Recommended)

---

### Q4: What counts as an "unsaved change" for the beforeunload guard?

| Option | Description | Selected |
|--------|-------------|----------|
| Any comparison since last successful sync | `comparisonsTotal > comparisonsAtLastSync`. Survives page reloads. Resets after each sync. | ✓ |
| Any comparison since page load | `sessionComparisons > 0`. Simpler but misses comparisons from prior sessions. | |
| You decide | Claude decides the definition. | |

**User's choice:** Any comparison made since last successful sync (Recommended)

---

## Claude's Discretion

- BGG login endpoint URL and POST body format — implement from PITFALLS.md + smoke-test-dev.sh
- Throttle between writes — 200–500ms per SYNC-02; Claude picks delay strategy (random in range)
- Success message display duration before auto-return — Claude picks (~2 seconds)
- Cancel mid-sync behavior — whether cancel preserves `syncedGameIds` for resume or clears them

## Deferred Ideas

None — discussion stayed within Phase 3 scope.
