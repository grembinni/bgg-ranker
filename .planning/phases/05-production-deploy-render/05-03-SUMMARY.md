---
phase: 05-production-deploy-render
plan: 03
subsystem: infra
tags: [render, deployment, bgg-xml-api, cors-proxy, blocked]

# Dependency graph
requires:
  - phase: 05-production-deploy-render
    provides: "proxy/server/ Express proxy (05-01) and committed render.yaml Blueprint (05-02)"
provides:
  - "Live Render service (bgg-ranker-proxy) reachable at https://bgg-ranker-proxy.onrender.com, /healthz confirmed 200"
  - ".env.production wired to the live Render URL (VITE_BGG_API_BASE)"
  - "Root-cause diagnosis: BGG XML API now requires app-registration + Bearer-token auth (rolled out ~Oct 2025), blocking collection reads through the proxy"
affects: [05-03-live-verification-resume, any-future-bgg-api-auth-work]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .env.production
    - render.yaml

key-decisions:
  - "Paused phase 5 rather than push through — the blocker is an external BGG platform change (mandatory Bearer-token auth on the XML API), not a defect in this repo's proxy/render code, so no further code changes were attempted until a BGG API token is obtained"
  - "Live smoke test with real BGG credentials was run directly by the human in their own terminal, not by the executor agent, per an explicit no-credentials-in-chat instruction from the orchestrator"

patterns-established: []

requirements-completed: [SC-1, SC-3]

# Metrics
duration: paused (not complete)
completed: null
---

# Phase 5 Plan 3: Live Render Deploy + Verification — PAUSED (BGG XML API auth change)

**Render service is live and `.env.production` points at it (SC-1, SC-3 done), but the live smoke test fails with HTTP 401 on collection read — BGG rolled out mandatory XML API app-registration + Bearer-token auth in ~Oct 2025, unrelated to this repo's code. Phase 5 paused pending a BGG API token.**

## Performance

- **Started:** 2026-07-17T21:02:00-05:00 (approx., continuing from 05-02)
- **Paused:** 2026-07-18T02:49:53Z
- **Tasks:** 1 of 3 complete (Task 1); Task 2 partially complete (env wiring done, smoke test blocked); Task 3 not reached
- **Files modified:** 2 (`.env.production`, `render.yaml` — the latter fixed by the orchestrator mid-checkpoint, not by this executor)

## Accomplishments
- Verified the working tree was clean and pushed 49 previously-unpushed local commits (spanning several prior phases, including all of 05-01 and 05-02) to `origin/main` so Render's GitHub connection could see the committed proxy code and Blueprint
- Task 1 (human-verify checkpoint) approved: human connected the GitHub repo to Render via the dashboard OAuth flow and synced the Blueprint; live service confirmed at `https://bgg-ranker-proxy.onrender.com`, `GET /healthz` returns HTTP 200 (SC-1)
- Task 2 step 1: edited `.env.production` so `VITE_BGG_API_BASE=https://bgg-ranker-proxy.onrender.com` (no trailing slash), committed as `e8817f1` (SC-3)
- Task 2 step 2 (live smoke test) run by the human directly in their own terminal (credentials never entered this session): **failed** — `[1/3] Collection read` returned `HTTP 401`
- Root-caused the 401 (see Issues Encountered) — confirmed external, not a code defect

## Task Commits

Only Task 1 and part of Task 2 were reached before pausing:

1. **Task 1: Human connects the GitHub repo to Render and syncs the Blueprint** - human dashboard action, no repo commit from this plan; the Blueprint validation error the human hit mid-checkpoint was fixed by the orchestrator as `e6b1151` (fix, on `render.yaml`, technically a 05-02 artifact fixed during 05-03 execution)
2. **Task 2 (step 1 only): Point `.env.production` at the live URL** - `e8817f1` (chore)
3. **Task 2 (step 2): Live smoke test** - NOT committed (no code change; run resulted in FAIL, documented here)
4. **Task 3: Build/CORS verification checkpoint** - NOT reached

**Plan metadata:** this commit (docs: pause plan, document blocker)

## Files Created/Modified
- `.env.production` - `VITE_BGG_API_BASE` changed from empty string to `https://bgg-ranker-proxy.onrender.com` (SC-3 satisfied)
- `render.yaml` - orchestrator hotfix during the Task 1 checkpoint: removed a stray `value: "*"` from the `sync: false` `ALLOWED_ORIGIN` env var block. Render's Blueprint validator rejects an env var that specifies both `value` and `sync: true/false` simultaneously (`sync: false` means "dashboard-editable, no git-committed value"). Human re-applied the Blueprint successfully after this fix (`e6b1151`).

## Decisions Made
- Did not attempt to work around the BGG 401 by modifying the proxy (e.g., guessing at a Bearer token format) — the fix requires a BGG-issued token from a human registration step at `boardgamegeek.com/using_the_xml_api`, which is out of scope for autonomous code changes (Rule 4 — architectural/external-dependency change, requires user action, not a bug in existing code).
- Live smoke test execution was delegated to the human directly (not run by this executor with credentials passed through the agent session), per an explicit instruction to keep BGG credentials out of the chat/transcript.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, fixed by orchestrator not this executor] render.yaml Blueprint validation error**
- **Found during:** Task 1 checkpoint (human's first Blueprint-apply attempt)
- **Issue:** Render rejected the Blueprint with `services[0].envVars[1] cannot simultaneously specify fields value and sync`. `render.yaml` (committed in 05-02) had `ALLOWED_ORIGIN: { value: "*", sync: false }` — Render's schema does not allow both `value` and `sync` on the same env var, since `sync: false` means "value is set later via the dashboard, not git."
- **Fix:** Removed the `value: "*"` line, leaving `ALLOWED_ORIGIN` as a `sync: false` dashboard-managed var (human sets it manually post-deploy, or it starts unset/permissive depending on Render defaults — same intended risk-accepted-wildcard state as 05-02's T-05-03 disposition).
- **Files modified:** `render.yaml`
- **Verification:** Human re-applied the Blueprint after the fix; sync succeeded, service deployed, `/healthz` returned 200.
- **Committed in:** `e6b1151` (by the orchestrator, pulled into this session before Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking config error, fixed out-of-band by the orchestrator during the human checkpoint)
**Impact on plan:** Necessary fix to unblock the Blueprint sync; no scope creep — same wildcard-CORS-accepted posture as originally decided in 05-02.

## Issues Encountered

**BLOCKER — BGG XML API now requires app registration + Bearer-token authorization (external platform change, not a code defect):**

- Human ran the live smoke test (`RENDER_URL=https://bgg-ranker-proxy.onrender.com BGG_USERNAME=<user> BGG_PASSWORD=<pass> node scripts/smoke-test-render.mjs`) directly in their own terminal.
- Result: `[1/3] Collection read` failed with `HTTP 401`. Login and rating-write steps were never reached.
- Independent investigation (by the orchestrator, outside this proxy) confirmed the cause is external to this repo:
  - A direct `curl` to `boardgamegeek.com/xmlapi2/collection` (bypassing the Render proxy entirely, from a separate network) also returns `401` with header `WWW-Authenticate: Bearer realm="xml api"` — for both the human's own username and a well-known public username (`rahdo`).
  - Even `xmlapi2/thing?id=13` — historically a fully public, no-auth-required endpoint — returns the same 401.
  - Adding realistic browser headers (User-Agent, Accept, Accept-Language) does not change the result — ruled out as a simple bot/UA filter.
  - The same collection URL works fine in the human's own logged-in browser session (browser-side cookie auth still works; the XML API's server-to-server path does not).
  - Web research confirms BGG rolled out mandatory XML API registration + Bearer-token authorization around late October 2025 (BGG forum threads: "Registration and Authorization coming to the XML API", "Registration to use the XML API...is now open"). This is a genuine BGG platform change, not a Render egress IP block and not a defect in `proxy/server/`.
- **Scope impact:** Every server-side caller of `xmlapi2/collection` (and likely other `xmlapi2/*` read endpoints) must now send `Authorization: Bearer <token>`, where the token comes from registering an application on BGG's site — a human/browser action (BGG's own API docs page itself 403s to automated fetch tools, consistent with the same protection layer).
- **Untested:** The rating-write path (`/api/collectionitem/...` via the existing 3-cookie session relay, D-07's core requirement) was never reached in this run. Whether that endpoint is also gated behind the new Bearer-token requirement, or still works via the legacy cookie session, is unknown until a token is obtained and the collection-read step can be gotten past.
- **Not fixed in this plan:** Obtaining a BGG API token and wiring `Authorization: Bearer <token>` into `proxy/server/server.js`'s upstream request is new scope not covered by 05-01/05-02/05-03 as planned. Flagged for a follow-up plan (05-04 or a 05-03 revision) once the user has registered for a token.

## User Setup Required

**Action needed before phase 5 can resume:**
1. Register the app / obtain an XML API Bearer token at `boardgamegeek.com/using_the_xml_api` (BGG account required — this is the human/browser-only registration step referenced above).
2. Once a token exists, a follow-up plan needs to: (a) add the token as a Render env var (likely `sync: false`, dashboard-set, same pattern as `ALLOWED_ORIGIN`), and (b) update `proxy/server/server.js`'s upstream fetch/request to include `Authorization: Bearer <token>` on requests to `xmlapi2/*` endpoints (confirm whether the undocumented rating-write endpoint needs it too, or is unaffected).
3. Re-run `node scripts/smoke-test-render.mjs` against the live URL once the above is in place; resume at Task 2 of this plan.

## Next Phase Readiness

- **Not ready.** Phase 5 is paused, not complete. SC-1 and SC-3 are satisfied; SC-2, SC-4, SC-5 are blocked on the BGG API auth change described above.
- `render.yaml` and `.env.production` are both correctly configured for the live Render service — no further infra work needed once the Bearer-token wiring lands.
- Task 3 (build/CORS DevTools checkpoint) was never reached; no findings to report there yet.
- Do not mark this plan, phase 5, or the v1.1 milestone complete until the BGG auth blocker is resolved and Tasks 2–3 are re-run successfully.

---
*Phase: 05-production-deploy-render*
*Status: PAUSED — blocked on external BGG XML API auth change*
