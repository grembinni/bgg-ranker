# Roadmap: BGG Ranker

## Overview

Five phases, each delivering a complete testable capability. Phase 1 validates the dev CORS proxy and proves the bell-curve math. Phase 2 lets the user enter their BGG username (no password), fetch their collection, and immediately start ranking locally — no authentication required. Phase 3 adds BGG login (only needed to write ratings back) and batch sync. Phase 4 polishes the comparison screen with cover art and upset callouts. Phase 5 deploys the Firebase Cloud Function to production.

Phases 2–4 develop and test against the Vite dev proxy (`/bggapi/*`). All design decisions account for the Firebase production target: `VITE_BGG_API_BASE` switches proxy automatically, session tokens travel as JSON body (not Set-Cookie), and writes use `X-BGG-Session` header. Phase 5 activates production when the app is ready to ship.

## Milestones

- [x] **v0.9 — Core Loop** *(2026-05-25)* — Phases 1–3.1 complete; 22/24 v1 requirements. See [milestones/v0.9-ROADMAP.md](milestones/v0.9-ROADMAP.md)

## Active Phases (v1.0)

**Phase Numbering:**
- Integer phases (4, 5): Remaining planned work for v1.0
- Decimal phases: Urgent insertions if needed (marked with INSERTED)

---

### Phase 4: Display Polish
**Goal:** The comparison screen shows cover art for each game and acknowledges significant ranking upsets with a callout
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** DISP-01, DISP-02
**Success Criteria:**
  1. During every head-to-head comparison, each game's BGG thumbnail (cover art) is displayed alongside its name — no placeholder or missing image for any game that has a BGG thumbnail
  2. After a user picks a winner that was previously ranked significantly lower than the loser, the app shows a callout (e.g. "Moved up 12 spots") that is visible without scrolling and clears on the next comparison
**Plans:** 4 plans
Plans:
- [ ] 04-01-PLAN.md — Wave 0: extend existing test files with failing Phase 4 describe blocks (TDD RED phase)
- [ ] 04-02-PLAN.md — Wave 1a: store extension — lastUpset field, pick() upset detection, login() auto-resume, logout() action
- [ ] 04-03-PLAN.md — Wave 1b: GameCard upgrade — h-48 thumbnail, BGG page link, gray placeholder, #N rank (DISP-01)
- [ ] 04-04-PLAN.md — Wave 2: ComparisonView hamburger header + upset callout; UsernameEntry continue-prompt removal

### Phase 5: Firebase Production Deploy
**Goal:** Firebase Cloud Function deployed and production CORS proxy operational — the app runs end-to-end in production with no CORS errors
**Mode:** mvp
**Depends on:** Phase 4 (app feature-complete before production deploy)
**Requirements:** *(infrastructure — no app requirements)*
**Success Criteria:**
  1. Firebase CLI authenticated and `firebase deploy --only functions` completes without error; Function URL is live at `https://us-central1-PROJECT_ID.cloudfunctions.net/bgg`
  2. `.env.production` updated with the live Function URL as `VITE_BGG_API_BASE`
  3. `smoke-test-prod.sh` exits 0 with real credentials against the live Function URL: collection read succeeds (200 after poll if needed), login returns a sessionId, write path logged as `[OK]` or `[WARN]`
  4. `npm run build` succeeds with the production env var set; deployed static files reach BGG through the Firebase Function with no CORS errors
**Plans:** 1 plan (firebase-deploy)

**Note:** Firebase Function source code (`proxy/functions/src/index.ts`), `firebase.json`, `.firebaserc`, and `scripts/smoke-test-prod.sh` are already committed from Phase 1 Plan 01-04. Phase 5 only requires the CLI deploy step and updating `.env.production`.

**Firebase design decisions already in all phases:**
- Session token travels as JSON body `{ sessionId }` from Firebase Function to SPA (D-07) — never Set-Cookie relay
- Authenticated BGG writes use `X-BGG-Session` request header (D-08) — Firebase Function reattaches as Cookie to BGG
- `VITE_BGG_API_BASE` env var switches proxy automatically: `/bggapi` in dev, Firebase Function URL in prod
- Blaze (pay-as-you-go) plan required for outbound HTTP from Firebase Functions

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-05-23 |
| 2. Collection & Ranking | 3/3 | Complete | 2026-05-23 |
| 3. Auth & BGG Sync | 4/4 | Complete | 2026-05-24 |
| 3.1. Sync Repair | 2/2 | Complete | 2026-05-25 |
| 4. Display Polish | 0/4 | Not started | - |
| 5. Firebase Production Deploy | 0/1 | Not started | - |