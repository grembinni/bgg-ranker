---
phase: 05
slug: production-deploy-render
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 |
| **Config file** | `vitest.config.ts` (repo root) — currently `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']`; does not cover a new `proxy/server/` directory |
| **Quick run command** | `npx vitest run <path-to-file>` |
| **Full suite command** | `npm test` (→ `vitest run`) |
| **Estimated runtime** | ~10-15 seconds (existing suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` on any new unit test file for extracted proxy cookie-parsing logic (if applicable)
- **After every plan wave:** Run `npm test` (full suite) + `node scripts/smoke-test-render.mjs` once the Render service is live
- **Before `/gsd-verify-work`:** Full Vitest suite green AND smoke test exits 0 against the live Render URL
- **Max feedback latency:** ~60 seconds (smoke test round-trip against live BGG + Render cold start)

---

## Per-Task Verification Map

This phase has no numbered `REQ-ID`s (infra/deploy phase, `phase_req_ids: null`). Mapping instead to the phase's 6 Success Criteria from ROADMAP.md — the planner should assign each task an SC reference in place of a REQ-ID.

| Task ID | Plan | Wave | Success Criterion | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|--------------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-* | 01 | 1 | SC-1 | — | Render Web Service deployed via `render.yaml`; URL live | smoke/manual | `curl -f https://<render-url>/healthz` | ❌ Wave 0 | ⬜ pending |
| 05-01-* | 01 | 1 | SC-2 | T-05-01 (header injection) | Proxy relays all 3 BGG cookies correctly on authenticated write | smoke | `node scripts/smoke-test-render.mjs` | ❌ Wave 0 | ⬜ pending |
| 05-01-* | 01 | 1 | SC-3 | — | `.env.production` has the live Render URL | trivial/manual | `grep VITE_BGG_API_BASE .env.production` | — | ⬜ pending |
| 05-01-* | 01 | 1 | SC-4 | — | Automated real-credential smoke test exits 0 | smoke | `node scripts/smoke-test-render.mjs` | ❌ Wave 0 | ⬜ pending |
| 05-01-* | 01 | 1 | SC-5 | — | `npm run build` succeeds; no CORS errors reaching BGG through the proxy | build + manual browser check | `npm run build && npm run preview` (manual DevTools Network tab check) | — | ⬜ pending |
| 05-01-* | 01 | 1 | SC-6 | — | Firebase artifacts removed | trivial/manual | `test ! -e proxy/functions && test ! -e firebase.json && test ! -e .firebaserc` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs above are placeholders (`05-01-*`) — the planner assigns final task IDs; this table's SC mapping is the binding contract, not the exact IDs.*

---

## Wave 0 Requirements

- [ ] `proxy/server/server.js` (or `.ts`) — new Express proxy service, does not exist yet (core deliverable)
- [ ] `proxy/server/package.json` — new package, own `express`/`cors` deps
- [ ] `render.yaml` — repo root, does not exist yet
- [ ] `scripts/smoke-test-render.mjs` — does not exist yet (confirmed: no `scripts/` directory in repo at all)
- [ ] `/healthz` route in the Express app — needed for `render.yaml`'s `healthCheckPath` and SC-1 live-URL verification
- [ ] `vitest.config.ts` `include` glob — extend to `proxy/**/*.test.ts` **only if** unit tests are added for extracted cookie-parsing pure functions; otherwise no change needed

---

## Manual-Only Verifications

| Behavior | Success Criterion | Why Manual | Test Instructions |
|----------|--------------------|------------|--------------------|
| GitHub repo connection to Render | SC-1 (prerequisite) | Browser-only OAuth flow (D-05) — no CLI/API equivalent for the initial connection; cannot be automated by an executor agent | Human opens Render dashboard, connects the GitHub repo via Blueprint sync flow before the executor can trigger a deploy |
| `npm run build` + browser CORS check | SC-5 | No automated CORS-in-browser test planned; requires visual DevTools Network tab inspection | Run `npm run build && npm run preview`, open DevTools Network tab, confirm no CORS errors on requests routed through the Render proxy |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

Confirmed by gsd-plan-checker against 05-01/05-02/05-03-PLAN.md: every `auto` task carries a runnable `<automated>` verify command, no watch-mode flags, sampling continuity intact.

**Approval:** approved 2026-07-17
