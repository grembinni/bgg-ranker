# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v0.9 — Core Loop

**Shipped:** 2026-05-25
**Phases:** 5 (1, 2, 3, 3.1 + planning) | **Plans:** 13

### What Was Built
- Full TypeScript + React 19 + Vite 6 + Zustand SPA with bell-curve ranking engine
- BGG XML API2 client: 202 polling, dual-query (owned + previously-rated), HTML entity decode
- Comparison loop: pick/skip/refresh, localStorage persistence, 990-game ceiling
- BGG auth + batch sync with dirty-game tracking, 1s throttle, 401 inline re-auth
- Drag-and-drop ranked list reordering, unplayed game management, dev proxy session fallback

### What Worked
- TDD RED-first approach: writing failing tests before implementation kept scope tight and verified behavior before claiming done
- Phase 3.1 insertion (decimal phase): addressed sync write path failures without disrupting the v0.9 close cadence
- Integer-internal rating storage (801 = 8.01) eliminated float precision issues completely — the constraint paid off immediately
- dirtyGameIds pattern (vs syncedGameIds) — cleaner semantics, easier to reason about

### What Was Inefficient
- PERSIST-02 was claimed implemented in 04-02-SUMMARY.md but wasn't — the claim in the summary wasn't caught until the milestone audit
- Phase 3.1 was unplanned; sync write path wasn't validated against live BGG early enough

### Patterns Established
- Module-level timer variables (completeSyncTimer, upsetTimer) — prevents serialization to null in Zustand persist
- `partialize` explicit allowlist — safer than denylist for state persistence
- Per-game dirty tracking (dirtyGameIds) rather than a global dirty flag

### Key Lessons
1. Validate sync write path against live BGG earlier — the proxy works in dev but the write endpoint is undocumented and needs live testing
2. SUMMARY.md "provides" claims need code evidence, not just plan references — a grep during review would have caught PERSIST-02 before milestone audit
3. Decimal phase insertion (3.1) works well for urgent fixes without renumbering

---

## Milestone: v1.0 — Full Feature Release

**Shipped:** 2026-05-26
**Phases:** 1 (Phase 4) | **Plans:** 4
**Stats:** 33 commits · 43 files · 1,702 src LOC

### What Was Built
- BGG cover art (192px) on every comparison card — DISP-01
- Upset callout ("Game moved up N spots") with 5s auto-clear — DISP-02
- Hamburger menu consolidates Sync/Refresh/Logout into comparison screen header
- PERSIST-02 auto-resume: `login()` guard skips fetchCollection for returning users
- Firebase Function routing fix: `req.path` replaces `req.query['path']` (was broken for production)
- Logout preserves rankings; re-login resumes session without re-fetch

### What Worked
- TDD wave structure (Wave 0 RED → Wave 1 GREEN) kept Phase 4 focused; the 15 failing tests established a clear target before any implementation
- Milestone audit caught both the PERSIST-02 gap and Firebase routing mismatch before close — valuable pre-ship check
- UAT 8-item checklist was fast to run and surfaced the PERSIST-02 behavioral ambiguity (user said "it resumes" but code was always re-fetching)

### What Was Inefficient
- PERSIST-02 was documented as done in 04-02-SUMMARY.md but wasn't implemented — the describe block was renamed in tests to reflect "always fetches" behavior, which made it clear in retrospect but wasn't caught during execution
- The Firebase Function routing mismatch (req.query['path'] vs client direct path appending) existed since Phase 1 but wasn't caught until the integration checker ran during milestone audit — earlier production smoke testing would have surfaced this faster

### Patterns Established
- upsetTimer at module scope (not React state, not Zustand) — correct pattern for timers with Zustand persist
- PERSIST-02 guard belongs in `login()`, not `fetchCollection()` — `fetchCollection` should always fetch when called; the resume logic lives at the entry point
- Hamburger pattern: each handler calls `setMenuOpen(false)` then the store action — keeps menu close and action atomic

### Key Lessons
1. A milestone audit integration checker is worth running before UAT, not after — it found the Firebase routing mismatch that would have blocked Phase 5
2. UAT behavioral ambiguity (user can't distinguish "fast re-fetch" from "true resume") means some requirements need explicit test instrumentation, not just visual observation
3. SUMMARY.md claims should be grep-verified during review — "provides: login() auto-resume" should trigger a `grep continueSession src/store/store.ts` check

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.9 | 5 (1-3.1) | 13 | Baseline; Phase 3.1 inserted for sync repair |
| v1.0 | 1 (4) | 4 | Shorter; milestone audit + UAT pattern established |

### Cumulative Quality

| Milestone | Tests | Nyquist Compliant | Blockers at Close |
|-----------|-------|-------------------|-------------------|
| v0.9 | 162 | 3/5 phases | 2 (PERSIST-02, Firebase routing) |
| v1.0 | 169 | 5/5 phases | 0 |

### Top Lessons (Verified Across Milestones)

1. **Verify claims against code at review time** — two milestones in a row had SUMMARY.md claims that weren't matched by live code. A quick grep during summary review prevents this.
2. **Run integration checker before UAT** — catches wiring mismatches that UAT can miss (Firebase routing, `continueSession()` never called)
3. **Module-level timers for Zustand persist** — confirmed correct pattern; avoids serialization issues and timer leaks
