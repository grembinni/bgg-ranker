# Phase 5: Production Deploy (Render) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 5-production-deploy-render
**Areas discussed:** Cookie-handling gap, Missing smoke-test-prod.sh, Firebase project readiness, Stale proxy/README.md, Render pivot (user-added), Render setup (tech + deploy mechanism), Render account status, Cookie relay design, Smoke test scope

---

## Initial area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Cookie-handling gap | Firebase Function relays only `sessionid`; dev proxy comment says BGG needs all 3 cookies | ✓ |
| Missing smoke-test-prod.sh | ROADMAP.md claims it's committed from Phase 1; repo search shows it doesn't exist | ✓ |
| Firebase project readiness | `.firebaserc` still has placeholder `YOUR_FIREBASE_PROJECT_ID` | ✓ |
| Stale proxy/README.md | Documents a `?path=` convention that contradicts the actual `req.path`-based code | ✓ |
| (user-added, free text) | "refactor the plan to target render instead of firebase as the deployment env" | ✓ |

**User's choice:** All four surfaced areas, plus a free-text addition proposing a full deployment-vendor pivot from Firebase to Render.
**Notes:** The free-text addition reframed everything else — Firebase-specific areas (cookie fix location, Firebase project setup, Firebase-flavored README) only make sense once the vendor question is resolved first.

---

## Render pivot

| Option | Description | Selected |
|--------|-------------|----------|
| Simpler ops, no GCP/Blaze billing | Render avoids needing a paid Blaze-plan Firebase project for outbound HTTP; delete Firebase artifacts, write a Node/Express proxy for Render instead | ✓ |
| Already have a Render account/project set up | Same code change, motivated by existing infra rather than cost | |
| Keep Firebase as-is, don't pivot | Stick with the existing Firebase Function; proceed with the other 3 areas against current Firebase code | |

**User's choice:** Simpler ops, no GCP/Blaze billing.
**Notes:** Confirmed as a full pivot — delete `proxy/functions/`, `firebase.json`, `.firebaserc`; new Node/Express proxy on Render. This supersedes PROJECT.md's "Firebase Cloud Functions (Blaze)" decision row.

---

## Render setup (tech + deploy mechanism)

| Option | Description | Selected |
|--------|-------------|----------|
| Node + Express, render.yaml Blueprint | Committed Blueprint file for repeatable, git-reviewable deploy config | ✓ |
| Node + Express, manual dashboard setup | Same app, but service config lives outside the repo | |
| Plain Node http (no framework) | Closest to the old Firebase Function's raw style; more boilerplate | |

**User's choice:** Node + Express, render.yaml Blueprint.

---

## Render account status

| Option | Description | Selected |
|--------|-------------|----------|
| Account exists, repo not yet connected | Plan should include connecting the GitHub repo + creating the Web Service, not account creation | ✓ |
| Account exists and repo is connected | Plan just needs to configure the new proxy service | |
| Nothing set up yet | Plan needs to note manual account/GitHub-connection prerequisite | |

**User's choice:** Account exists, repo not yet connected.

---

## Cookie relay design

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the dev proxy's 3-cookie store/replay exactly | Replicate `vite.config.ts`'s proven logic — the only approach confirmed to work against live BGG | ✓ |
| Start with sessionid-only, expand only if smoke test fails | Keep it as simple as the old Firebase Function; let the smoke test prove the need empirically | |

**User's choice:** Mirror the dev proxy's 3-cookie store/replay exactly.
**Notes:** User picked the proactive fix once shown the `vite.config.ts` code comment as evidence, rather than deploy-then-discover.

---

## Test + docs scope (first pass)

| Option | Description | Selected |
|--------|-------------|----------|
| Write smoke-test-prod.sh per Phase 1's original spec | Bash script, env-var credentials, tests read + write paths, non-zero exit on failure | |
| Rewrite proxy/README.md for Render | Replace Firebase-specific setup/verification docs with Render equivalents | ✓ |

**User's choice:** Rewrite proxy/README.md for Render (only). Smoke-test-prod.sh option was not selected — ambiguous, since Phase 5's success criteria still require an automated real-credential smoke test. Followed up below.

---

## Smoke test — follow-up (resolving the ambiguity above)

| Option | Description | Selected |
|--------|-------------|----------|
| Build it, just not per the old bash-script spec | Still required before calling the phase done, but planner picks bash vs. Node vs. other implementation | ✓ |
| Skip automated smoke test — manual verification only | Revise/drop success criterion #4 in favor of a manual checkpoint | |
| Actually yes, build smoke-test-prod.sh per Phase 1's spec | Re-selecting the original bash-script design; treat prior non-selection as a mis-click | |

**User's choice:** Build it, just not per the old bash-script spec.
**Notes:** Confirms the smoke test is still required (Success Criterion #4 stands); only the exact script format is left to the planner.

---

## Claude's Discretion

- Exact Express route structure/middleware choices for the new proxy — follow the old Function's `isLogin` branch-on-path pattern as a starting reference.
- Smoke test script language/format (bash vs. Node) — planner's call, as long as it covers both the read and write paths per D-10.
- Whether `render.yaml` lives at repo root or under `proxy/` — default to repo root unless it conflicts with existing config.

## Deferred Ideas

None — the Render pivot is a HOW decision for the already-scoped "production CORS proxy" deliverable, not a new capability. Discussion stayed within phase scope.
