# Milestones: BGG Ranker

## v0.9 — Core Loop ✅ SHIPPED 2026-05-25

**Phases:** 1–3.1 (13 plans)
**Timeline:** 2026-05-22 → 2026-05-25 (4 days)
**Stats:** 98 commits · 103 files · ~3,800 src LOC

**What shipped:**
- Full TypeScript + React 19 + Vite 6 + Zustand + TanStack Query + Tailwind 4 SPA
- Bell-curve ranking engine with integer-internal storage (801 = 8.01), verified unique up to 373 games
- BGG XML API2 client: 202 polling, HTML entity decode, owned + previously-rated dual-query
- Comparison loop: pick/skip/refresh, localStorage persistence, 990-game ceiling
- BGG authentication + batch sync with dirty-game tracking, 1s throttle, 401 inline re-auth
- Drag-and-drop ranked list reordering, unplayed game management, dev proxy session fallback

**Known gaps at close:**
- DISP-01 (thumbnails) and DISP-02 (upset callouts) — Phase 4
- Firebase production deploy — Phase 5
- No verified live BGG sync against real account (5 human UAT items in 03.1-VERIFICATION.md)

**Archives:**
- [v0.9-ROADMAP.md](milestones/v0.9-ROADMAP.md) — full phase details
- [v0.9-REQUIREMENTS.md](milestones/v0.9-REQUIREMENTS.md) — requirements with final status (22/24 validated)

---

## v1.0 — Full Feature Release ✅ SHIPPED 2026-05-26

**Phases:** 4 (display polish)
**Timeline:** 2026-05-25 → 2026-05-26 (2 days)
**Stats:** 33 commits · 43 files · 1,702 src LOC

**What shipped:**
- BGG cover art (192px) shown on every comparison card — DISP-01
- Upset callout ("Game moved up N spots") with 5s auto-clear — DISP-02
- Hamburger menu consolidates Sync/Refresh/Logout — cleaned comparison screen
- PERSIST-02 auto-resume: same-user login calls `continueSession()` instead of re-fetching from BGG
- Firebase Function routing fixed: `req.path` replaces `req.query['path']` for production API calls
- Logout action preserves rankings; re-login resumes session instantly

**Known gaps at close:**
- Phase 5 (Firebase production deploy) deferred to v1.1
- Phase 1 VERIFICATION.md absent — RANK-06/07/08/09 code correct but no formal verification doc
- Firebase 1-cookie vs 3-cookie BGG auth — unverified in production

**Archives:**
- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) — full phase details
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) — final requirement status (19/24 satisfied, 4 partial doc-only, 1 deferred)
- [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) — integration audit (23/23 wired, 0 blockers)

---

*Next milestone: v1.1 — Production Deploy (Phase 5 Firebase Cloud Function)*
