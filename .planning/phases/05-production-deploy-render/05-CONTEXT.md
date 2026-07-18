# Phase 5: Production Deploy (Render) - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy a production CORS proxy so the app runs end-to-end in production with no CORS errors — this was originally scoped as a Firebase Cloud Functions deploy (code + config already committed from Phase 1), but during this discussion the user pivoted to **Render** instead (simpler ops, no Blaze-plan GCP billing required). The phase boundary itself is unchanged (production CORS proxy operational); only the implementation vendor changed.

This phase now includes: writing a new Node/Express proxy service, deploying it to Render via a committed `render.yaml` Blueprint, deleting the obsolete Firebase artifacts, updating `.env.production`, and proving the whole path works with an automated real-credential smoke test.

**ROADMAP.md's Phase 5 entry has already been updated** (Goal, Success Criteria, and phase name) to reflect this pivot — see the "Note (superseded 2026-07-17)" there for the short version. This CONTEXT.md is the full decision record.

</domain>

<decisions>
## Implementation Decisions

### Render vs. Firebase (the pivot)
- **D-01:** Production CORS proxy moves from Firebase Cloud Functions to **Render**. Reason: simpler ops, avoids requiring a paid Blaze-plan Firebase project just for outbound HTTP. This supersedes PROJECT.md's Key Decisions row "Firebase Cloud Functions (Blaze) ... replaces Cloudflare Worker plan" — planner/executor should flag PROJECT.md for an update at phase close (not this phase's job to edit it directly).
- **D-02:** Delete the obsolete Firebase artifacts as part of this phase: `proxy/functions/` (including `src/index.ts`, `package.json`, `tsconfig.json`, `package-lock.json`), `firebase.json`, `.firebaserc`. Nothing to migrate — the Render service is a fresh implementation, not a port.

### Render Proxy Implementation
- **D-03:** Written in **Node + Express**. Chosen over a framework-less `http.createServer` (closest to the old Firebase Function's style but more boilerplate) for readability of the request-forwarding + cookie logic.
- **D-04:** Deployed via a **committed `render.yaml` Blueprint** (not manual dashboard configuration) — keeps the service definition in git, reviewable and repeatable, consistent with how `firebase.json` served the same role for the old approach.
- **D-05:** User already has a Render account; the GitHub repo is **not yet connected**. Plan must include the repo-connection step (via Render's Blueprint sync flow) but not account creation.
- **D-06:** Same client-side interface as before: `VITE_BGG_API_BASE` env var switches between `/bggapi` (dev) and the live Render URL (prod). No client-side (`src/`) changes expected beyond `.env.production`.

### Cookie Handling — Confirmed Gap, Now Fixed at the Source
- **D-07:** The proxy **must relay all three BGG session cookies** (SessionID + bggusername + bggpassword) on authenticated write requests — mirror `vite.config.ts`'s dev-proxy logic exactly (capture the full `Set-Cookie` set on login, store it, replay it on subsequent authenticated requests). This is a **verified, not speculative**, requirement: `vite.config.ts`'s own code comment states "BGG requires all three cookies (SessionID + bggusername + bggpassword)," and the dev proxy's working implementation stores/replays all three. The old Firebase Function only relayed a single `sessionid` cookie — a confirmed functional gap that risked 401s on the production write path. Decision: build the new Render proxy correctly from the start rather than deploy-then-discover.
- **D-08:** Still keep the `X-BGG-Session` request-header convention for the SPA → proxy leg (client sends the header; proxy is the one that translates it into the full `Cookie:` header sent to BGG) — same client-facing contract as the old Firebase Function, so no `src/api/bggClient.ts`-side changes are needed.

### Smoke Test
- **D-09:** An automated real-credential smoke test is still required before calling this phase done (Success Criterion #4) — but the planner picks the implementation (bash script, small Node script, whatever fits the Render deploy flow best) rather than being locked to Phase 1's original bash-only `scripts/smoke-test-prod.sh` design. It does **not exist today** despite ROADMAP.md's old note claiming it was "already committed from Phase 1" — that claim was false; confirmed by direct repo search (no `scripts/` directory exists at all).
- **D-10:** Must test both paths against the live Render URL: collection read (BGG XML API) and the authenticated rating write (login → session → rate one game). Exits non-zero on failure, per the original Phase 1 design intent — this part of the old spec still holds even though the exact script format is now the planner's call.

### Documentation
- **D-11:** `proxy/README.md` gets rewritten for Render — the current version documents Firebase-specific setup steps and a stale `?path=` query-param proxy convention that never matched the actual (already-fixed) `req.path`-based routing in the old Function code. Following its own curl examples today would produce misleading verification results. Full rewrite, not a patch.

### Claude's Discretion
- Exact Express route structure / middleware choices for the new proxy (single catch-all route vs. separate `/login` and forwarding routes) — implementation detail, follow the old Function's `isLogin` branch-on-path pattern as a starting reference.
- Smoke test script language/format (D-09) — bash or Node, planner's call, as long as it satisfies D-10's coverage requirement.
- Whether `render.yaml` lives at repo root or under `proxy/` — repo-root is more conventional for Render Blueprints; default to that unless it conflicts with existing root-level config.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cookie handling — the proven reference implementation
- `vite.config.ts` (lines ~11-83) — the dev proxy's `configure()` block is the **only confirmed-working** BGG cookie handling in this codebase. Its code comment explicitly states BGG requires all three cookies (SessionID + bggusername + bggpassword); it captures the full `Set-Cookie` set on login (`proxySession` variable) and replays it on subsequent requests. The new Render proxy must replicate this logic, not the old Firebase Function's single-cookie approach.

### Obsolete Firebase artifacts (to be deleted per D-02)
- `proxy/functions/src/index.ts` — old Firebase Function; single-cookie relay (`Cookie: sessionid=${req.headers['x-bgg-session']}`), confirmed gap per D-07. Useful only as a reference for the `isLogin`-branch request-forwarding pattern (D-Discretion item), then delete.
- `firebase.json`, `.firebaserc` (`.firebaserc` still has the unfilled `YOUR_FIREBASE_PROJECT_ID` placeholder — was never actually configured) — delete.
- `proxy/README.md` — rewrite per D-11; current content describes Firebase setup + the stale `?path=` convention.

### Prior phase decisions (carry forward)
- `.planning/phases/01-foundation/01-CONTEXT.md` D-07 (sessionId returned as JSON body from the proxy on login), D-08 (`X-BGG-Session` header convention for authenticated writes — **stays unchanged** per D-08 above), D-13/D-14 (original smoke-test design intent — read + write path coverage, non-zero exit on failure — coverage requirement carries forward per D-10, exact format does not per D-09)
- `.planning/phases/03-auth-bgg-sync/03-CONTEXT.md` D-17/D-18 (`bggLogin`/`bggRateGame` client functions — these call the proxy URL from `VITE_BGG_API_BASE`; unaffected by the Render pivot since the client-facing contract is unchanged per D-06/D-08)
- CLAUDE.md's "Key constraint" line still says "...a Cloudflare Worker in production" — already stale before this phase (superseded by Firebase, now superseded again by Render). Not this phase's job to edit CLAUDE.md, but planner/executor should flag it for a follow-up doc-accuracy fix; it will actively mislead future sessions if left as-is.

### Milestone audit context
- `.planning/v1.1-MILESTONE-AUDIT.md` — the audit that immediately preceded this discussion; flagged Phase 5 as the sole blocker for milestone v1.1 completion, and separately flagged the same cookie-handling risk (there framed as "carried from v1.0 audit," here confirmed by direct code read) as tech debt requiring resolution before production rollout.

No other external specs, ADRs, or design docs exist for the Render pivot — it's a same-session decision, fully captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vite.config.ts`'s cookie store/replay logic (D-07's canonical reference) — the pattern to port into the new Express proxy, not reuse directly (different runtime — Express request/response objects vs. Vite's proxy middleware hooks).
- Old Firebase Function's `isLogin`-branch request-forwarding structure (`proxy/functions/src/index.ts`) — useful shape reference for the new Express routes before deletion (D-02).

### Established Patterns
- Client-side proxy interface is env-var-driven and vendor-agnostic already: `VITE_BGG_API_BASE` (`/bggapi` dev, live URL prod) is the only thing that needs to change per environment — confirmed in `proxy/README.md`'s existing (soon-to-be-rewritten) instructions and `.env.production`/`.env.development`. This means the Render pivot needs zero `src/` changes.
- `X-BGG-Session` custom header is the established client→proxy session-token convention (both the dev proxy and the old Firebase Function use it); D-08 keeps this so `src/api/bggClient.ts` needs no changes.

### Integration Points
- `.env.production` — `VITE_BGG_API_BASE` gets the new Render service URL (Success Criterion #3).
- Repo root — likely location for the new `render.yaml` Blueprint (Claude's Discretion).
- `proxy/` directory — old Firebase subtree gets deleted (D-02); new Render proxy code needs a home (planner's call on exact path, e.g. `proxy/server/` or similar, mirroring the old `proxy/functions/` structure).

</code_context>

<specifics>
## Specific Ideas

- User's stated reason for the Render pivot: "simpler ops, no GCP/Blaze billing" — cost and operational simplicity, not a technical limitation of Firebase.
- The cookie-handling fix is explicitly framed as "build correctly from the start" rather than "deploy first, discover the bug via smoke test" — the user picked the proactive option once shown the `vite.config.ts` evidence.
- Smoke test coverage bar is explicit: must exercise the real write path (rate one game against live BGG), not just the read path — this was true in the original Firebase-era plan too and carries forward unchanged.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. The Render-vs-Firebase pivot is a HOW decision (implementation vendor for the already-scoped "production CORS proxy" deliverable), not a new capability.

### Reviewed Todos (not folded)
None — `.planning` has no pending todos file for this project (confirmed via `todo.match-phase` query, 0 matches).

</deferred>

---

*Phase: 5-production-deploy-render*
*Context gathered: 2026-07-17*
