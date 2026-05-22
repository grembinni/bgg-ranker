# Phase 1: Foundation - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate all external dependencies and prove the bell-curve ranking engine correct — **no UI, no Zustand store, no comparison loop**. Phase 1 ends when:
- Vite dev proxy can fetch a real BGG collection without a CORS error
- Firebase Cloud Function proxy is deployed and the same collection fetch + rating write succeed against the live URL
- `rankingEngine.ts` unit tests pass with all invariants verified (uniqueness, tier ranges, integer storage, 990-game ceiling)

</domain>

<decisions>
## Implementation Decisions

### Project Scaffold
- **D-01:** Install the full tech stack in Phase 1 — React 19, Vite 6, TypeScript, Zustand 5, TanStack Query 5, fast-xml-parser 4, Tailwind 4 (`@tailwindcss/vite`), Vitest 2, `@testing-library/react`, `@testing-library/jest-dom`. Phase 2 starts coding immediately with no dependency setup.
- **D-02:** Establish the full folder structure upfront: `src/engine/`, `src/api/`, `src/store/`, `src/components/`, `proxy/functions/`. Most folders will have placeholder/index files only until Phase 2 fills them in. This prevents reorganization later.
- **D-03:** Entry point is a minimal `App.tsx` that renders only "BGG Ranker" — no UI features. Enough to confirm the Vite dev server runs and the proxy config is active.

### Production CORS Proxy — Firebase Cloud Functions (Blaze plan)
- **D-04:** Use **Firebase Cloud Functions** (Node.js/TypeScript) instead of Cloudflare Workers as the production CORS proxy. The user has an existing Firebase project; the project ID is supplied as an environment variable at execution time (`FIREBASE_PROJECT_ID`). The Blaze (pay-as-you-go) plan is required — outbound HTTP to external services is not available on the Spark free tier.
- **D-05:** The Firebase Cloud Function is the **only** production proxy. The Vite dev proxy (`/bggapi/*`) is the dev proxy. Both environments use the same client-side `VITE_BGG_API_BASE` env var (`/bggapi` in dev, the Firebase Function URL in prod).
- **D-06:** The Firebase Function lives in `proxy/functions/src/index.ts` with a standard `firebase.json` and `proxy/functions/package.json`. Deployed via `firebase deploy --only functions` using the Firebase CLI.

### Cookie/Session Strategy
- **D-07:** The Firebase Function extracts BGG's `Set-Cookie` value from the login response and returns it as a JSON field (`{ sessionId: "..." }`). The SPA stores this in Zustand `SessionState` (in-memory only, never written to localStorage — AUTH-03). Subsequent authenticated write calls send the session token as a custom request header (e.g., `X-BGG-Session`); the Function reattaches it as `Cookie: sessionid=...` before forwarding to BGG.
- **D-08:** The Vite dev proxy uses `cookieDomainRewrite: 'localhost'` so BGG's `Set-Cookie` works on localhost. In dev, the same JSON-body pattern applies (same client code, same proxy interface).

### Ranking Engine
- **D-09:** `rankingEngine.ts` lives at `src/engine/rankingEngine.ts` as pure TypeScript functions with no I/O, no DOM, no side effects. The engine is the only substantive code written in Phase 1 (beyond scaffold and proxy config).
- **D-10:** All ratings stored internally as integers (`801` = 8.01). Division by 100 happens only at display time and BGG sync time. This is enforced in the engine API — functions accept and return integers.
- **D-11:** Tier 1 lower bound is **clamped to 1.00** (integer `100`) rather than 0.01. BGG may reject sub-1.0 values (pitfall m4). The smoke test in Phase 1 will verify the accepted range; the engine clamps defensively.
- **D-12:** `validateTierCapacity(collectionSize)` is called before every initialization. Hard ceiling: 990 games. If exceeded, throws a typed `TierCapacityError` that the store (Phase 2) will surface to the user.

### Smoke Tests
- **D-13:** Smoke tests are shell scripts committed to `scripts/`: `smoke-test-dev.sh` (tests via Vite proxy at `localhost:5173`) and `smoke-test-prod.sh` (tests via Firebase Function URL). Credentials supplied via environment variables (`BGG_USERNAME`, `BGG_PASSWORD`, `FIREBASE_URL`) — never committed.
- **D-14:** Each script tests both the collection read path and the rating write path end-to-end. Write test posts credentials → receives session token → writes one rating → logs the HTTP response. The scripts exit non-zero on any failure.

### Claude's Discretion
- Cloudflare Workers were evaluated and rejected in favor of Firebase (user decision). The Worker code pattern is similar; the Firebase Function uses the same request-forwarding logic.
- Exact Firebase Function URL format will be determined at deploy time and documented in `proxy/README.md` for the user to add to their prod env vars.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Full requirement list; Phase 1 implements RANK-06, RANK-07, RANK-08, RANK-09, RANK-10
- `.planning/ROADMAP.md` — Phase 1 success criteria (the 5 numbered items under Phase 1)

### Architecture & Stack
- `.planning/research/STACK.md` — Tech stack decisions and rationale (all versions, CORS deep dive, BGG auth flow, installation commands)
- `.planning/research/ARCHITECTURE.md` — Component boundaries (`bggClient.ts`, `rankingEngine.ts`, `store.ts`), Zustand slice interfaces, localStorage schema, build order

### Pitfalls to Mitigate in Phase 1
- `.planning/research/PITFALLS.md` — Critical pitfalls: C1 (202 polling), C2 (cookie handling in proxy), C4 (tier capacity overflow), C5 (float precision) and minor pitfalls m2 (small collections), m4 (tier 1 lower bound)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — codebase is empty. Phase 1 creates the scaffold from scratch.

### Established Patterns
- None yet — Phase 1 establishes the patterns all subsequent phases follow.

### Integration Points
- `src/engine/rankingEngine.ts` (Phase 1) → consumed by `src/store/store.ts` (Phase 2) — the engine API shape matters: pure functions, integer-in/integer-out
- `proxy/functions/src/index.ts` (Phase 1) → referenced by `src/api/bggClient.ts` (Phase 2) via `VITE_BGG_API_BASE` env var
- `vite.config.ts` proxy config (Phase 1) → used by all Phase 2+ development

</code_context>

<specifics>
## Specific Ideas

- The Firebase Function should be colocated in the repo under `proxy/functions/` (not a separate repo) — same commit history, same deploy trigger
- `VITE_BGG_API_BASE` env var pattern: `.env.development` has `/bggapi`, `.env.production` has the Firebase Function URL (user fills this in after deploy)
- Smoke test scripts should log the full HTTP status, headers, and first 200 chars of response body for each call — enough to diagnose proxy or BGG issues without credential leakage

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-22*
