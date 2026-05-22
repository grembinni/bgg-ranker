# BGG Ranker — Project Guide

## Project Overview

Browser SPA that helps BGG users rank their board game collection through head-to-head comparisons. Maintains a bell-curve distribution (tiers 1–10, decimal precision) and syncs ratings back to BGG.

**Tech stack:** React 19 + Vite 6 + TypeScript + Zustand + TanStack Query + fast-xml-parser + Tailwind 4 + Vitest

**Key constraint:** BGG API has no CORS headers. All requests must go through the Vite dev proxy (`/bggapi/*`) in development and a Cloudflare Worker in production.

## Planning Structure

All planning artifacts live in `.planning/`:
- `PROJECT.md` — project context and requirements summary
- `REQUIREMENTS.md` — 24 v1 requirements with REQ-IDs
- `ROADMAP.md` — 4-phase execution plan
- `STATE.md` — current phase and progress
- `research/` — domain research (stack, features, architecture, pitfalls)
- `phases/` — per-phase plans and verification (created during execution)

## GSD Workflow

This project uses the GSD (Get Shit Done) workflow. Follow this sequence for each phase:

```
/gsd:discuss-phase N   → gather context and clarify approach
/gsd:plan-phase N      → create PLAN.md for the phase
/gsd:execute-phase N   → execute the plan with atomic commits
/gsd:verify-work N     → verify phase goal is achieved
```

**Current phase:** Phase 1 — Foundation

## Critical Implementation Rules

### Ranking Engine
- **Always use integer-internal storage** for ratings (`801` = 8.01). Never store or compute with raw floats. Divide by 100 only at display/BGG sync time.
- Tier N covers `[N*100, (N-1)*100 + 1]` in integer space. Tier 9 = integers 801–900.
- Hard ceiling: 990 games maximum (99 values × 10 tiers). Validate before every init or refresh.
- `applyUpset()` is O(k) — only touches games between winner and loser positions. `redistribute()` is O(n) — only called on explicit user Refresh.

### BGG API
- BGG collection endpoint may return **HTTP 202** on first call. Always poll with retry loop (3s delay, 8 retries max). Never write to localStorage on a 0-game result.
- Use `?subtype=boardgame` on collection requests by default to exclude expansions.
- The rating write endpoint (`/api/geekrating`) is undocumented — isolate behind a single `bggRateGame()` adapter function.

### Authentication
- Credentials (`username` + `password`) live in Zustand `SessionState` only — **never persisted to localStorage**. This satisfies AUTH-03.
- The `persist` middleware `partialize` function must explicitly exclude `SessionState`.
- The BGG read API (collection fetch) only needs a username — no password required until sync.

### State
- UI components never call `bggClient` directly. All API calls go through the Zustand store.
- `CollectionState` and `RankingsState` are persisted. All other slices are session-only.
- localStorage key format: `bgg-ranker:v1:<slice>` (versioned to prevent stale schema corruption).
- On load: if `PersistedRankings.username !== currentUsername`, discard stored rankings.

## Commit Convention

Each plan within a phase commits atomically. Commit messages:
- `feat: <description>` — new functionality
- `fix: <description>` — bug fix
- `test: <description>` — tests only
- `chore: <description>` — tooling, config
- `docs: <description>` — planning docs only
