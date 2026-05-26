# Roadmap: BGG Ranker

## Milestones

- ✅ **v0.9 — Core Loop** *(2026-05-25)* — Phases 1–3.1 · Core ranking, sync, persistence. See [milestones/v0.9-ROADMAP.md](milestones/v0.9-ROADMAP.md)
- ✅ **v1.0 — Full Feature Release** *(2026-05-26)* — Phase 4 · Display polish, auto-resume, Firebase routing fix. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 📋 **v1.1 — Production Deploy** — Phase 5 · Firebase Cloud Function live

## Phases

<details>
<summary>✅ v0.9 Core Loop (Phases 1–3.1) — SHIPPED 2026-05-25</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-05-23
- [x] Phase 2: Collection & Ranking (3/3 plans) — completed 2026-05-23
- [x] Phase 3: Auth & BGG Sync (4/4 plans) — completed 2026-05-24
- [x] Phase 3.1: Sync Repair (2/2 plans) — completed 2026-05-25

</details>

<details>
<summary>✅ v1.0 Full Feature Release (Phase 4) — SHIPPED 2026-05-26</summary>

- [x] Phase 4: Display Polish (4/4 plans) — completed 2026-05-26

</details>

### 📋 v1.1 Production Deploy

- [ ] Phase 5: Firebase Production Deploy (1 plan)

**Phase 5 Goal:** Firebase Cloud Function deployed and production CORS proxy operational — the app runs end-to-end in production with no CORS errors

**Phase 5 Success Criteria:**
1. Firebase CLI authenticated and `firebase deploy --only functions` completes; Function URL live
2. `.env.production` updated with live Function URL as `VITE_BGG_API_BASE`
3. `smoke-test-prod.sh` exits 0 with real credentials: collection read, login, write path all succeed
4. `npm run build` succeeds; static files reach BGG through Firebase Function with no CORS errors

**Note:** Firebase Function source code, `firebase.json`, `.firebaserc`, and `scripts/smoke-test-prod.sh` already committed from Phase 1. Phase 5 only requires the CLI deploy step and updating `.env.production`.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v0.9 | 4/4 | Complete | 2026-05-23 |
| 2. Collection & Ranking | v0.9 | 3/3 | Complete | 2026-05-23 |
| 3. Auth & BGG Sync | v0.9 | 4/4 | Complete | 2026-05-24 |
| 3.1. Sync Repair | v0.9 | 2/2 | Complete | 2026-05-25 |
| 4. Display Polish | v1.0 | 4/4 | Complete | 2026-05-26 |
| 5. Firebase Deploy | v1.1 | 0/1 | Not started | — |
