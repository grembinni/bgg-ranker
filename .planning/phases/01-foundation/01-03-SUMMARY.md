---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [vite, proxy, cors, bash, smoke-test, bgg-api]

# Dependency graph
requires:
  - phase: 01-01
    provides: Vite project scaffold with react() and tailwindcss() plugins (vite.config.ts base)
provides:
  - Vite dev proxy /bggapi/* → boardgamegeek.com with cookie Secure flag stripped and domain rewritten to localhost
  - scripts/smoke-test-dev.sh: 202 poll loop, login session extraction, write path [WARN] handling
affects: [02-store, 03-auth, phase-2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vite proxy configure callback strips Set-Cookie Secure flag for HTTP localhost dev (C2 pitfall mitigation)"
    - "BGG 202 poll loop: 8 retries x 3s delay before [FAIL] (C1 pitfall mitigation)"
    - "Smoke test logs session ID length only (${#SESSION_ID}) — never value (T-03-01 information disclosure mitigation)"
    - "Write endpoint non-2xx treated as [WARN] not [FAIL] — undocumented endpoint, Assumption A1"

key-files:
  created:
    - scripts/smoke-test-dev.sh
  modified:
    - vite.config.ts

key-decisions:
  - "vite.config.ts proxy config matches Pattern 1 from RESEARCH.md exactly — no secure:false (target is https://, BGG cert verified correctly)"
  - "Smoke test write failure is [WARN] not [FAIL] — /api/geekrating is [ASSUMED] undocumented endpoint per A1"
  - "Session ID logged as length only per T-03-01 threat mitigation — BGG_PASSWORD never echoed to stdout"

patterns-established:
  - "Pattern: /bggapi/* proxy routes to boardgamegeek.com server-side — browser never sees BGG domain, eliminating CORS"
  - "Pattern: smoke test credentials from BGG_USERNAME / BGG_PASSWORD env vars — never hard-coded"

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-05-22
---

# Phase 01 Plan 03: Vite Dev Proxy + Smoke Test Script Summary

**Vite dev proxy routing /bggapi/* to boardgamegeek.com with cookie Secure-flag stripping, plus bash smoke test covering 202 poll loop, login session extraction, and best-effort write path**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-22T16:10:00Z
- **Completed:** 2026-05-22T16:20:00Z
- **Tasks:** 2
- **Files created/modified:** 2

## Accomplishments

- Vite dev proxy config verified complete in `vite.config.ts`: target `https://boardgamegeek.com`, `changeOrigin: true`, `cookieDomainRewrite: 'localhost'`, `configure` callback strips `Secure` flag from `Set-Cookie` headers (C2 pitfall mitigation per Pattern 1)
- `scripts/smoke-test-dev.sh` created with full 202 poll loop (8 retries, 3s delay), login session extraction from `Set-Cookie` header with JSON body fallback, and write path that logs `[WARN]` on non-2xx (undocumented endpoint)
- All security requirements met: credentials from env vars only, session ID logged as length never value, BGG_PASSWORD never echoed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Vite dev proxy config for /bggapi/*** - `8e925b6` (feat)
2. **Task 2: Create dev smoke test script (scripts/smoke-test-dev.sh)** - `3970a05` (feat)

**Plan metadata:** (committed with SUMMARY below)

## Files Created/Modified

- `vite.config.ts` — Vite config with React + Tailwind plugins and /bggapi proxy with cookieDomainRewrite and Secure flag stripping
- `scripts/smoke-test-dev.sh` — Dev proxy smoke test: 202-aware collection read, login session extraction, [WARN] write path

## Decisions Made

- Proxy config matches RESEARCH.md Pattern 1 verbatim — `secure: false` deliberately excluded (target is `https://`, BGG cert validates correctly; only the `Set-Cookie` header value has `Secure` stripped, not TLS verification)
- Write endpoint failure logged as `[WARN]` not `[FAIL]` because `/api/geekrating` is community-discovered with `[ASSUMED]` status — smoke test purpose is empirical verification, not hard assertion
- Session ID logged as `${#SESSION_ID}` (character count) to satisfy T-03-01 information disclosure threat mitigation

## Deviations from Plan

None - plan executed exactly as written. The `important_context` note was correct: vite.config.ts already had the full proxy config on `main` from Plan 01-01. In this worktree (branched from pre-01-01 state), the file was created fresh to match the same Pattern 1 spec exactly.

## Issues Encountered

- Worktree working directory was at the pre-01-01 state (only CLAUDE.md, README.md, .gitignore, .planning/). Files written to `D:/dev/repo/bgg-ranker/` initially, then redirected to the worktree root `D:/dev/repo/bgg-ranker/.claude/worktrees/agent-a438f2641d19723f5/` where git staging operates. No functional impact — both files now correctly committed to the worktree branch.

## User Setup Required

None - no external service configuration required. The smoke test requires Vite dev server running (`npm run dev`) and real BGG credentials (`BGG_USERNAME`, `BGG_PASSWORD`) to execute, but these are user-supplied env vars, not project config.

## Next Phase Readiness

- Vite proxy config committed — `curl http://localhost:5173/bggapi/xmlapi2/collection?username=X` routes to BGG without CORS errors when `npm run dev` is running
- Smoke test ready for manual execution: `BGG_USERNAME=your_username BGG_PASSWORD=your_password bash scripts/smoke-test-dev.sh`
- Phase 2 BGG client (`bggClient.ts`) can use `VITE_BGG_API_BASE=/bggapi` prefix for all API calls without CORS configuration

## Self-Check: PASSED

- `vite.config.ts` contains `boardgamegeek.com`: confirmed (grep count 1)
- `vite.config.ts` contains `cookieDomainRewrite`: confirmed (grep count 1)
- `bash -n scripts/smoke-test-dev.sh`: exits 0
- Commits exist: `8e925b6` (vite.config.ts), `3970a05` (smoke-test-dev.sh)

---
*Phase: 01-foundation*
*Completed: 2026-05-22*
