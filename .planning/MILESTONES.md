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

*Next milestone: v1.0 — Full Feature Release (Phase 4 display polish + Phase 5 Firebase deploy)*
