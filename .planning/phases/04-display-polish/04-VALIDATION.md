---
phase: 4
slug: display-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + @testing-library/react 16 + jsdom |
| **Config file** | `vitest.config.ts` — `environmentMatchGlobs: ['src/**/*.test.tsx', 'jsdom']` |
| **Quick run command** | `npm test -- --reporter=verbose src/components/ComparisonView.test.tsx src/store/store.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/components/ComparisonView.test.tsx src/store/store.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | DISP-01 | — | N/A | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | DISP-01 | — | N/A | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | DISP-02 | — | lastUpset excluded from partialize | unit (node) | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | DISP-02 | — | N/A | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | D-07 | — | sessionId not persisted | unit (node) | `npm test -- src/store/store.test.ts` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 2 | D-08 | — | N/A | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/ComparisonView.test.tsx` — extend with Phase 4 assertions (DISP-01 thumbnail/placeholder, DISP-02 callout, D-08 hamburger). File exists; add new `describe` blocks.
- [ ] `src/store/store.test.ts` — extend with `pick()` upset detection tests (D-03) and `login()` auto-resume tests (D-07). File exists; add new `describe` blocks.

*No new test files required — both test files exist and patterns are established.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BGG thumbnail link opens correct game page in new tab | DISP-01 | Browser navigation; not testable in jsdom | Click image during comparison; verify `boardgamegeek.com/boardgame/{id}` opens in new tab |
| Callout auto-clears after 5 seconds | DISP-02 | Timer-based UI; fake timers cover unit but real timing needs manual confirm | Pick an upset; wait 5 seconds; verify callout disappears without interaction |
| Hamburger dropdown closes on menu item selection | D-08 | Interaction sequence hard to reliably test in jsdom | Open hamburger, click Sync/Refresh/Logout; verify dropdown closes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending