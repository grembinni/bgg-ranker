# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 1-Foundation
**Areas discussed:** Scaffold scope, Cloudflare Worker depth (became Firebase), Smoke test format

---

## Scaffold Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full stack now | Install all deps upfront: React, Zustand, TanStack Query, fast-xml-parser, Tailwind, Vitest | ✓ |
| Minimum viable only | Install only Vite + TypeScript + Vitest; add deps in Phase 2 | |
| You decide | Claude picks based on what minimizes total setup time | |

**User's choice:** Full stack now

| Option | Description | Selected |
|--------|-------------|----------|
| Full structure upfront | Create all directories (src/engine/, src/api/, src/store/, src/components/) now | ✓ |
| Only what Phase 1 needs | Just src/engine/ and proxy/; Phase 2 adds the rest | |

**User's choice:** Full structure upfront

**Notes:** Phase 2 starts coding immediately — no reorganization or dep setup needed.

---

## Production CORS Proxy

| Option | Description | Selected |
|--------|-------------|----------|
| Deploy to Cloudflare now | wrangler CLI deploy; live Worker URL verified end-to-end | |
| Write + local test only | Worker code written and wrangler dev tested; actual deploy deferred | |
| You decide | Claude decides based on what gives most confidence before Phase 2 | ✓ |

**User's choice:** You decide → Claude selected "deploy with wrangler" but user then requested a proxy switch.

**Mid-discussion change:** User requested switching from Cloudflare Workers to Firebase.

| Option | Description | Selected |
|--------|-------------|----------|
| Firebase Cloud Functions | Node.js proxy function, requires Blaze plan for outbound HTTP | ✓ |
| Firebase Hosting rewrites | Can't add CORS headers standalone — still needs Cloud Functions | |
| Firebase App Hosting + Cloud Run | More infrastructure; not needed for a simple proxy | |
| You decide | Claude picks simplest free-tier approach | |

**User's choice:** Firebase Cloud Functions (Blaze plan, pay-as-you-go)

**Note:** Claude flagged that Firebase Spark (free) plan cannot make outbound HTTP calls to external services. User accepted Blaze plan (billing enabled, but effectively free at personal-use volume).

**User's choice on Firebase project:** Existing project (project ID supplied at execution time).

| Option | Description | Selected |
|--------|-------------|----------|
| Return session token in JSON body | Worker/Function extracts Set-Cookie, returns as JSON field; SPA stores in memory | ✓ |
| Relay Set-Cookie as-is | Worker passes BGG's Set-Cookie to browser natively; simpler Worker code | |

**User's choice:** Return session token in JSON body

**Notes:** Aligns with AUTH-03 (credentials never in localStorage). SPA sends session token as custom header `X-BGG-Session` on write calls; Function reattaches as `Cookie` upstream.

---

## Smoke Test Format

| Option | Description | Selected |
|--------|-------------|----------|
| Shell scripts with env vars | Committed to scripts/; credentials via env vars | ✓ |
| Vitest integration tests (skip by default) | Written as .skip tests; run via npm run test:smoke | |
| README curl commands only | Documented only, no committed scripts | |

**User's choice:** Shell scripts with env vars

| Option | Description | Selected |
|--------|-------------|----------|
| Both dev and prod scripts | smoke-test-dev.sh (localhost) + smoke-test-prod.sh (Firebase URL) | ✓ |
| Dev only | Only localhost proxy tested via script | |
| Prod only | Only Firebase Function URL tested | |

**User's choice:** Both — separate scripts for dev and prod

**Notes:** Each script tests both collection read AND rating write paths. Exit non-zero on failure.

---

## Claude's Discretion

- **Cloudflare → Firebase switch:** User requested Firebase; Claude evaluated free-tier constraints and recommended Cloud Functions on Blaze plan. User accepted.
- **Tier 1 clamping:** Claude decided to clamp tier 1 lower bound to 1.00 (integer 100) rather than 0.01, given BGG may reject sub-1.0 values (pitfall m4). Will be verified empirically during smoke testing.
- **Firebase Function URL pattern:** Determined at deploy time; documented in `proxy/README.md`.

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
