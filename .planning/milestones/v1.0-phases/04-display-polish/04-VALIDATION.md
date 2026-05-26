---
phase: 4
slug: display-polish
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
audited: 2026-05-26
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
| 4-01-01 | 01 | 1 | DISP-01 | — | N/A | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ✅ | ✅ green |
| 4-01-02 | 01 | 1 | DISP-01 | — | N/A | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ✅ | ✅ green |
| 4-02-01 | 02 | 1 | DISP-02 | — | lastUpset excluded from partialize | unit (node) | `npm test -- src/store/store.test.ts` | ✅ | ✅ green |
| 4-02-02 | 02 | 1 | DISP-02 | — | N/A | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ✅ | ✅ green |
| 4-03-01 | 03 | 2 | D-07 | — | sessionId not persisted | unit (node) | `npm test -- src/store/store.test.ts` | ✅ | ✅ green |
| 4-03-02 | 03 | 2 | D-08 | — | N/A | unit (jsdom) | `npm test -- src/components/ComparisonView.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/components/ComparisonView.test.tsx` — extended with Phase 4 assertions (DISP-01 thumbnail/placeholder, DISP-02 callout, D-08 hamburger). Three new describe blocks added in 04-01.
- [x] `src/store/store.test.ts` — extended with `pick()` upset detection tests (D-03) and `login()` auto-resume tests (D-07). Two new describe blocks added in 04-01.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BGG thumbnail link opens correct game page in new tab | DISP-01 | Browser navigation; not testable in jsdom | Click image during comparison; verify `boardgamegeek.com/boardgame/{id}` opens in new tab |
| Callout auto-clears after 5 seconds | DISP-02 | Timer-based UI; fake timers cover unit but real timing needs manual confirm | Pick an upset; wait 5 seconds; verify callout disappears without interaction |
| Hamburger dropdown closes on menu item selection | D-08 | Interaction sequence hard to reliably test in jsdom | Open hamburger, click Sync/Refresh/Logout; verify dropdown closes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ Nyquist-compliant — 2026-05-26

---

## Validation Audit 2026-05-26

| Metric | Count |
|--------|-------|
| Tasks audited | 6 |
| COVERED | 6 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated to manual-only | 0 |

Full suite: **158/158 tests passing** at audit time. Pre-existing 3 unhandled-rejection warnings in `bggClient.test.ts` error-throw tests (not caused by Phase 4 changes).
