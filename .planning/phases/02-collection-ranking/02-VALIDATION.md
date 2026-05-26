---
phase: 2
slug: collection-ranking
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-23
audited: 2026-05-26
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + jsdom (store tests use node environment with mock storage) |
| **Config file** | `vitest.config.ts` (`environment: 'node'`, `globals: true`) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

**Note:** Global environment is `node`. Tests that need `localStorage` use a custom mock storage object (see Pitfall 6 in RESEARCH.md). Tests that need React rendering use `// @vitest-environment jsdom` docblock.

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| COLL-01 | `parseCollectionXml` extracts id, name, yearPublished, thumbnail | unit | `npm test` | ✅ | ✅ green |
| COLL-01 | `poll202Loop` retries on 202, succeeds on 200 | unit (fetch mock) | `npm test` | ✅ | ✅ green |
| COLL-01 | `parseCollectionXml` with 0 items throws | unit | `npm test` | ✅ | ✅ green |
| COLL-01 | `parseCollectionXml` with single item (not array) works | unit | `npm test` | ✅ | ✅ green |
| COLL-01 | 990-game collection: `validateTierCapacity` passes | unit | `npm test` | ✅ | ✅ green |
| COLL-01 | 991-game collection: shows error, does NOT persist | unit | `npm test` | ✅ | ✅ green |
| COLL-03 | `mergeCollections` deduplicates by objectid, owned wins | unit | `npm test` | ✅ | ✅ green |
| RANK-01 | Store: `fetchCollection` calls `initializeRankings` on first use | unit (store + mock client) | `npm test` | ✅ | ✅ green |
| RANK-02 | `selectRandomPair` returns 2 distinct IDs | unit | `npm test` | ✅ | ✅ green |
| RANK-03 | `pick(winner, loser)` updates `ratings` via `applyUpset` | unit | `npm test` | ✅ | ✅ green |
| RANK-04 | `skip()` appends pair to skipQueue; next `pick()` drains queue first | unit | `npm test` | ✅ | ✅ green |
| RANK-05 | `pick()` increments both `sessionComparisons` and `comparisonsTotal` | unit | `npm test` | ✅ | ✅ green |
| REFRESH-01 | `refresh()` calls `redistribute`, ratings change, order preserved | unit | `npm test` | ✅ | ✅ green |
| PERSIST-01 | After `pick()`, ratings appear in mocked localStorage | unit | `npm test` | ✅ | ✅ green |
| PERSIST-02 | `fetchCollection` always fetches (guard moved to `login()` in Phase 4) | unit | `npm test` | ✅ | ✅ green |
| PERSIST-02 | `fetchCollection` discards stored rankings when username differs | unit | `npm test` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note on PERSIST-02:** The original "shows continue-or-refetch prompt when username matches" test was updated in Phase 4 (04-02) when the PERSIST-02 auto-resume guard moved from `fetchCollection()` to `login()`. The current test at store.test.ts:134 verifies the new always-fetch behavior. The auto-resume guard itself is tracked as a BLOCKER in `v1.0-MILESTONE-AUDIT.md`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BGG 202 response polling visible in loading UI | COLL-01 | Requires real BGG API call | Enter a valid BGG username; observe loading indicator during the 202 polling window |
| Collection loads for a real BGG user | COLL-01 | Requires real BGG API | Enter a real BGG username; verify owned boardgames appear, expansions excluded |
| Continue-or-refetch prompt appears on return | PERSIST-02 | Requires page reload | Complete some comparisons, reload, re-enter same username; verify auto-resume (pending BLOCKER fix) |
| Rankings survive page reload | PERSIST-01 | Requires page reload | Complete comparisons, reload, re-enter same username; verify rankings unchanged |
| 990-game error UI | RANK-10 | No test fixture with 990+ games | Simulate by patching `validateTierCapacity` or using a BGG account with 990+ games |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] All requirements covered
- [x] No watch-mode flags — all commands use `npm test` (not `--watch`)
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ Nyquist-compliant — 2026-05-26

---

## Validation Audit 2026-05-26

| Metric | Count |
|--------|-------|
| Tasks audited | 16 |
| COVERED | 16 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated to manual-only | 0 |

Full suite: **158/158 tests passing** at audit time.
Test files: `src/api/bggClient.test.ts` (22 tests covering COLL-01/03) · `src/store/store.test.ts` (covers all store requirements).
