---
phase: 3
slug: auth-bgg-sync
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
audited: 2026-05-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract covering auth-bgg-sync (03-01 through 03-04) and sync-repair (03.1-01 through 03.1-02).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + @testing-library/react 16 + jsdom |
| **Config file** | `vitest.config.ts` — `environmentMatchGlobs: ['src/**/*.test.tsx', 'jsdom']` |
| **Quick run command** | `npm test -- --reporter=verbose src/api/bggClient.test.ts src/store/store.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/api/bggClient.test.ts src/store/store.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | AUTH-01, SYNC-01 | T-03-01 | bggLogin/bggRateGame RED import failures confirm no premature impl | unit (node) | `npm test -- src/api/bggClient.test.ts` | ✅ | ✅ green |
| 3-01-02 | 01 | 1 | AUTH-01 – SYNC-03 | T-03-01 | sessionId absent from partialize (RED test pre-impl) | unit (node) | `npm test -- src/store/store.test.ts` | ✅ | ✅ green |
| 3-02-01 | 02 | 2 | AUTH-01, SYNC-01 | T-03-02, T-03-03 | bggLogin throws on non-2xx; bggRateGame status thrown for 401 | unit (node) | `npm test -- src/api/bggClient.test.ts` | ✅ | ✅ green |
| 3-02-02 | 02 | 2 | AUTH-01, AUTH-03, SYNC-01 – SYNC-03 | T-03-01, T-03-05 | sessionId excluded from partialize; syncedGameIds persisted | unit (node) | `npm test -- src/store/store.test.ts` | ✅ | ✅ green |
| 3-03-01 | 03 | 3 | AUTH-01, AUTH-02 | T-03-06 | password in local React state; login() called (not bggClient directly) | unit (jsdom) | `npm test -- src/components/UsernameEntry.test.tsx` | ✅ | ✅ green |
| 3-03-02 | 03 | 3 | AUTH-02 | — | beforeunload predicate: dirtyGameIds.length > 0 | unit (node) | `npm test -- src/store/store.test.ts` | ✅ | ✅ green |
| 3-04-01 | 04 | 3 | AUTH-03, SYNC-01, SYNC-02, SYNC-03 | T-03-09 | reAuthPassword in local state; inline re-auth wired to store | unit (jsdom) | `npm test -- src/components/SyncingView.test.tsx` | ✅ | ✅ green |
| 3-04-02 | 04 | 3 | SYNC-01, AUTH-03 | T-03-10, T-03-11 | Sync button disabled when !sessionId \|\| dirtyGameIds.length===0 | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ✅ | ✅ green |
| 3.1-01-01 | 03.1-01 | 1 | SYNC-01 | T-03-02 | bggRateGame sends ajax=1; error body logged before throw | unit (node) | `npm test -- src/api/bggClient.test.ts` | ✅ | ✅ green |
| 3.1-01-02 | 03.1-01 | 1 | SYNC-02 | T-03-05 | 500ms fixed throttle applied between writes; skips after last | unit (node) | `npm test -- src/store/store.test.ts` | ✅ | ✅ green |
| 3.1-02-01 | 03.1-02 | 2 | SYNC-03 | — | dirtyGameIds persisted; only changed IDs marked dirty per-pick | unit (node) | `npm test -- src/store/store.test.ts` | ✅ | ✅ green |
| 3.1-02-02 | 03.1-02 | 2 | SYNC-01, SYNC-02, SYNC-03, AUTH-02 | — | startSync iterates dirtyGameIds; App.tsx + ComparisonView guard on dirtyGameIds | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/api/bggClient.test.ts` — bggLogin (3 tests) + bggRateGame (7 tests) appended in 03-01
- [x] `src/store/store.test.ts` — 8 Phase 3 describe blocks (login, startSync, markGameSynced, completeSyncAll, reAuthAndResume, cancelSync, beforeunload predicate, persistence) added in 03-01; throttle describe added at validation time
- [x] `src/components/SyncingView.test.tsx` — 12 tests across 4 syncStatus states added in 03-04
- [x] `src/components/ComparisonView.test.tsx` — 5 Sync button tests + 7 hamburger tests added in 03-04
- [x] `src/components/UsernameEntry.test.tsx` — 3 form validation + login() wiring tests added at validation time

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BGG sync succeeds end-to-end (ratings appear on BGG profile) | SYNC-01 | Requires live BGG session and network traffic to boardgamegeek.com | Log in with valid credentials; make comparisons; click Sync; verify star ratings update at boardgamegeek.com/user/USERNAME/ratings |
| Proxy fallback cookie path (after dev server restart) | SYNC-01 | proxySession=null path requires a runtime dev server restart after login | Log in, stop Vite dev server, restart it; without re-logging-in, click Sync; expect success (X-BGG-Session fallback cookie exercises the null proxySession branch) |
| `window.beforeunload` fires in browser | AUTH-02 | jsdom does not fire real unload events | Make comparisons; attempt to close the tab; verify browser shows "Leave site?" dialog |
| Sync button disabled after complete sync | SYNC-02 | Requires visual inspection post-sync | Complete a full sync; verify Sync to BGG button is grayed out (dirtyGameIds empty) |
| Sync button re-enables after next pick | SYNC-02 | Reactive dirtyGameIds.length update requires visual confirm | After sync completes (button disabled), make one comparison; verify button becomes enabled |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ Nyquist-compliant — 2026-05-26

---

## Validation Audit 2026-05-26

| Metric | Count |
|--------|-------|
| Tasks audited | 12 |
| COVERED | 10 |
| PARTIAL (before audit) | 2 |
| Gaps found | 2 |
| Resolved | 2 |
| Escalated to manual-only | 0 |

**Gaps resolved:**
- AUTH-01 UI: Added `src/components/UsernameEntry.test.tsx` (3 tests) — password validation, login() call wiring
- SYNC-02 throttle: Added `describe('startSync throttle')` to `store.test.ts` (1 test) — fake-timer assertion that second write fires exactly at 500ms

Full suite: **162/162 tests passing** at audit time. Pre-existing 3 unhandled-rejection warnings in `bggClient.test.ts` error-throw tests (not caused by Phase 3 changes; present since Phase 1).
