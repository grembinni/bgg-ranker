---
phase: 2
slug: collection-ranking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 |
| **Config file** | `vitest.config.ts` (`environment: 'node'`, `globals: true`) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

**Note:** Global environment is `node`. Tests that need `localStorage` must use a custom mock storage object (see Pitfall 6 in RESEARCH.md). Tests that need React rendering must use `// @vitest-environment jsdom` docblock.

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
| COLL-01 | `parseCollectionXml` extracts id, name, yearPublished, thumbnail | unit | `npm test -- src/api/bggClient.test.ts` | ❌ W0 | ⬜ pending |
| COLL-01 | `poll202Loop` retries on 202, succeeds on 200 | unit (fetch mock) | `npm test -- src/api/bggClient.test.ts` | ❌ W0 | ⬜ pending |
| COLL-01 | `parseCollectionXml` with 0 items throws | unit | `npm test -- src/api/bggClient.test.ts` | ❌ W0 | ⬜ pending |
| COLL-01 | `parseCollectionXml` with single item (not array) works | unit | `npm test -- src/api/bggClient.test.ts` | ❌ W0 | ⬜ pending |
| COLL-03 | `mergeCollections` deduplicates by objectid, owned wins | unit | `npm test -- src/api/bggClient.test.ts` | ❌ W0 | ⬜ pending |
| RANK-01 | Store: `fetchCollection` calls `initializeRankings` on first use | unit (store + mock client) | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| RANK-02 | `selectRandomPair` returns 2 distinct IDs | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| RANK-03 | `pick(winner, loser)` updates `ratings` via `applyUpset` | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| RANK-04 | `skip()` appends pair to skipQueue; next `pick()` drains queue first | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| RANK-05 | `pick()` increments both `sessionComparisons` and `comparisonsTotal` | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| REFRESH-01 | `refresh()` calls `redistribute`, ratings change, order preserved | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| PERSIST-01 | After `pick()`, ratings appear in mocked localStorage | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| PERSIST-02 | `fetchCollection` shows prompt when `rankingsUsername === username` | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| PERSIST-02 | `fetchCollection` discards stored rankings when username differs | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| COLL-01 | 990-game collection: `validateTierCapacity` passes | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| COLL-01 | 991-game collection: shows error, does NOT persist | unit | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/api/bggClient.test.ts` — XML parse tests (COLL-01, COLL-03), 202 poll tests, merge/dedup tests, HTML-200 guard test
- [ ] `src/store/store.test.ts` — all store action tests; requires custom mock storage + mock bggClient

**Mock storage pattern (for `environment: 'node'`):**
```typescript
const mockStorage: Record<string, string> = {}
const testStorage = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v },
  removeItem: (k: string) => { delete mockStorage[k] },
}
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BGG 202 response polling visible in loading UI | COLL-01 | Requires real BGG API call | Enter a valid BGG username; observe loading indicator during the 202 polling window |
| Collection loads for a real BGG user | COLL-01 | Requires real BGG API | Enter a real BGG username (e.g., your own); verify all owned boardgames appear, expansions excluded |
| Continue-or-refetch prompt appears on return | PERSIST-02 | Requires page reload | Complete some comparisons, reload, re-enter same username; verify prompt shows game count |
| Rankings survive page reload | PERSIST-01 | Requires page reload | Complete comparisons, reload, re-enter same username, continue session; verify rankings unchanged |
| 990-game error UI | RANK-10 | No test fixture with 990+ games | Simulate by patching `validateTierCapacity` or using a BGG account with 990+ games |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
