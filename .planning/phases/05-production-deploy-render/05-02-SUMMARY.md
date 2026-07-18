---
phase: 05-production-deploy-render
plan: 02
subsystem: infra
tags: [render, render-yaml, blueprint, firebase-cleanup, docs]

# Dependency graph
requires:
  - phase: 05-production-deploy-render
    provides: "proxy/server/ Express proxy (05-01) — the service render.yaml deploys"
provides:
  - "render.yaml — committed Render Blueprint (free-tier Node web service, rootDir proxy/server)"
  - "Firebase footprint fully removed: proxy/functions/, firebase.json, .firebaserc"
  - "proxy/README.md rewritten for Render deployment + real req.path-based proxy routing"
affects: [05-03-live-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "render.yaml Blueprint at repo root drives Render's dashboard-connect-and-sync deploy flow (no CLI deploy step, unlike the removed Firebase flow)"

key-files:
  created:
    - render.yaml
  modified:
    - proxy/README.md
  deleted:
    - proxy/functions/src/index.ts
    - proxy/functions/package.json
    - proxy/functions/tsconfig.json
    - proxy/functions/package-lock.json
    - firebase.json
    - .firebaserc

key-decisions:
  - "render.yaml placed at repo root (Claude's Discretion per D-Discretion) — conventional Blueprint location, no conflict with existing root config"
  - "ALLOWED_ORIGIN set to wildcard with sync: false — accepted risk (T-05-03) since SPA→proxy leg uses X-BGG-Session header, not credentialed cookies; dashboard-tightenable later without redeploy"

patterns-established:
  - "Render Blueprint pattern: type/runtime/plan/region/rootDir/buildCommand/startCommand/healthCheckPath + envVars block, with plan: free set explicitly to avoid the paid starter-tier default"

requirements-completed: [SC-1, SC-6]

# Metrics
duration: 1min
completed: 2026-07-17
---

# Phase 5 Plan 2: Render Blueprint + Firebase Cleanup + README Rewrite Summary

**Committed `render.yaml` free-tier Node Blueprint wired to `proxy/server/`, deleted all obsolete never-deployed Firebase artifacts, and fully rewrote `proxy/README.md` to document the real Render deployment flow and req.path-based proxy routing.**

## Performance

- **Duration:** ~1 min (three small, independent file operations)
- **Started:** 2026-07-17T21:02:00-05:00 (approx.)
- **Completed:** 2026-07-17T21:02:57-05:00
- **Tasks:** 3 completed
- **Files modified:** 8 (1 created, 1 rewritten, 6 deleted)

## Accomplishments
- Created `render.yaml` at repo root: `type: web`, `runtime: node`, `plan: free` (explicit, avoids the paid `starter` default), `region: oregon`, `rootDir: proxy/server`, `buildCommand: npm install`, `startCommand: npm start`, `healthCheckPath: /healthz`, `NODE_VERSION=20.18.0`, `ALLOWED_ORIGIN="*"` (`sync: false`)
- Removed the entire never-deployed Firebase footprint: `proxy/functions/` (src/index.ts, package.json, tsconfig.json, package-lock.json), `firebase.json`, `.firebaserc` (SC-6)
- Fully rewrote `proxy/README.md` for the Render deployment flow: dashboard GitHub-connect + Blueprint sync (no CLI deploy step), real `req.path`-mirrored proxy routing (`PUT /api/collectionitem/{collId}`, not the stale `/api/geekrating`), and `node scripts/smoke-test-render.mjs` verification (not the nonexistent bash smoke script)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the render.yaml Blueprint at repo root** - `d1e5d2e` (feat)
2. **Task 2: Delete the obsolete Firebase artifacts** - `55d2b2f` (chore)
3. **Task 3: Rewrite proxy/README.md for Render** - `456d2c3` (docs)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `render.yaml` - Render Blueprint: free-tier Node web service `bgg-ranker-proxy`, rooted at `proxy/server`, health check at `/healthz`
- `proxy/README.md` - Full rewrite: Render deployment steps, real proxy interface (no `?path=` wrapper, no `/api/geekrating`), session token handling, quick verification via `curl` + `node scripts/smoke-test-render.mjs`
- `proxy/functions/` (deleted) - Never-deployed Firebase Cloud Function, superseded by `proxy/server/` (05-01)
- `firebase.json` (deleted) - Functions descriptor for the removed function
- `.firebaserc` (deleted) - Still had the `YOUR_FIREBASE_PROJECT_ID` placeholder, never configured

## Decisions Made
- `render.yaml` at repo root (Claude's Discretion per plan's D-Discretion) — this is Render's conventional Blueprint location and doesn't conflict with any existing root config file.
- `ALLOWED_ORIGIN: "*"` with `sync: false` accepted as a documented risk (T-05-03 in the plan's threat model): the SPA→proxy leg authenticates via a custom `X-BGG-Session` header rather than credentialed cookies, so an open-relay CORS policy still cannot obtain a BGG session without real BGG credentials. `sync: false` makes this a dashboard-only tightening later, no redeploy required.

## Deviations from Plan

**1. [Rule 1 - Bug] Removed literal `?path=` substring from README prose to pass the stale-reference gate**
- **Found during:** Task 3 (README rewrite) — automated verify command
- **Issue:** The verify script does a case-insensitive substring check for the literal text `?path=` anywhere in `proxy/README.md`, including inside a sentence explaining "there is no `?path=` query wrapper." That explanatory sentence itself tripped the gate even though it was correctly describing the absence of the old convention.
- **Fix:** Reworded the sentence to "there is no query-parameter path wrapper" — same meaning, no longer contains the literal stale token.
- **Files modified:** proxy/README.md
- **Verification:** Re-ran the plan's automated verify command; passed (no stale refs, all required tokens present).
- **Committed in:** 456d2c3 (Task 3 commit — the wording was fixed before the single Task 3 commit was made, so no separate fix commit was needed)

---

**Total deviations:** 1 auto-fixed (1 bug fix, caught before commit)
**Impact on plan:** No scope creep — same documented outcome (no `?path=` convention in the proxy interface), just phrased to avoid a false-positive on the literal-substring verify gate.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

**External service configuration deferred to plan 05-03 (live verification).** This plan only produces the committed Blueprint and documentation — it does not perform the human-in-the-loop Render dashboard connection (GitHub repo connect + Blueprint sync), which is a browser-only OAuth step with no CLI equivalent. See `proxy/README.md` "Production Deployment (Render)" section for the exact steps once 05-03 runs.

## Next Phase Readiness
- `render.yaml` is committed and ready for the Render dashboard to pick up in 05-03.
- `proxy/README.md` accurately documents the deploy flow and real proxy routing for whoever performs the dashboard connection.
- All Firebase artifacts are gone from the repo (SC-6 satisfied).
- Flagged but NOT fixed in this plan (per the plan's `artifacts_produced` follow-up note): `CLAUDE.md`'s "Key constraint" line still says "a Cloudflare Worker" for production (stale — now Render), and `PROJECT.md`'s Key Decisions row still names "Firebase Cloud Functions (Blaze)". Both are doc-accuracy fixes flagged for phase close (D-01), not blockers for 05-03.
- No blockers for plan 05-03 (live verification against a real Render deploy).

---
*Phase: 05-production-deploy-render*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created/modified files verified present on disk (render.yaml, proxy/README.md, this SUMMARY.md). Deleted files verified absent (proxy/functions/, firebase.json, .firebaserc). All 3 task commits (d1e5d2e, 55d2b2f, 456d2c3) verified present in git log.
