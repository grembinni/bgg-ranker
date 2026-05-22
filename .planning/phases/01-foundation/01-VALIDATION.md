---
phase: 1
slug: foundation
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 |
| **Config file** | `vitest.config.ts` (Wave 0 creates it — `environment: 'node'`, `globals: true`) |
| **Quick run command** | `npx vitest run src/engine/rankingEngine.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds (pure math tests; no DOM, no network) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/engine/rankingEngine.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full unit suite green + both smoke scripts exit 0
- **Max feedback latency:** ~5 seconds (unit) / ~30 seconds (smoke test incl. 202 poll)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| rankingEngine impl | 01 | 1 | RANK-06, RANK-07, RANK-08, RANK-09, RANK-10 | T1-C5 (float precision) | Integer storage — no floats in ratings object | unit | `npx vitest run src/engine/rankingEngine.test.ts` | ❌ Wave 0 | ⬜ pending |
| validateTierCapacity | 01 | 1 | RANK-10 | T1-C4 (overflow) | Throws TierCapacityError before init for >990 games | unit | `npx vitest run src/engine/rankingEngine.test.ts` | ❌ Wave 0 | ⬜ pending |
| applyUpset | 01 | 1 | — (Phase 2 RANK-03 prep) | — | No change when winner already ranked higher | unit | `npx vitest run src/engine/rankingEngine.test.ts` | ❌ Wave 0 | ⬜ pending |
| Vite proxy config | 02 | 1 | CORS (success criteria 1) | T1-C2 (cookie strip) | Cookie Secure flag stripped; domain rewritten to localhost | smoke | `bash scripts/smoke-test-dev.sh` | ❌ Wave 0 | ⬜ pending |
| Firebase Function | 03 | 2 | CORS (success criteria 2+3) | T1-C2, T1-M4 | sessionId returned as JSON body, never Set-Cookie relay | smoke | `bash scripts/smoke-test-prod.sh` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — `environment: 'node'`, `globals: true`, `include: ['src/**/*.test.ts']`
- [ ] `src/engine/rankingEngine.ts` — engine implementation (must exist for tests to import)
- [ ] `src/engine/rankingEngine.test.ts` — full unit test suite covering RANK-06 through RANK-10 and edge cases
- [ ] `scripts/smoke-test-dev.sh` — dev proxy smoke test (read path + write path via Vite proxy)
- [ ] `scripts/smoke-test-prod.sh` — prod smoke test (same paths via Firebase Function URL)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Firebase Function deployed and reachable | Success criteria 3 | Requires Blaze plan + active Firebase project + `firebase login` (interactive browser OAuth) | Run `bash scripts/smoke-test-prod.sh` with `FIREBASE_URL` env var set after deploy |
| BGG write endpoint accepted rating 0.5 (tier 1 range check) | Assumption A2 | Undocumented endpoint — BGG behavior not automatable in CI | During smoke test, check write response for rating=0.5; if 2xx, tier 1 can use full 99-slot range |
| BGG write endpoint exact field names | Assumption A1 | Reverse-engineered; may need DevTools inspection | If smoke write returns non-2xx, inspect BGG rating form submit in DevTools to get current fields |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 7 tasks across Plans 01-01 through 01-04 have `<verify><automated>` sections
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every task has automated verify
- [x] Wave 0 covers all MISSING references — 5 Wave 0 items listed cover all ❌ entries in the per-task map
- [x] No watch-mode flags — all commands use `npx vitest run` (not `vitest watch` or `--watch`)
- [x] Feedback latency < 30s — unit tests ~5s; smoke tests ~30s (includes 202 poll wait)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-05-22
