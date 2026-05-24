# Phase 2: Collection & Ranking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 2-Collection-Ranking
**Areas discussed:** App flow / screens, Game card content, Username persistence, Expansion toggle (COLL-02)

---

## App Flow / Screens

**Q1: How should the app present the user journey?**

| Option | Description | Selected |
|--------|-------------|----------|
| Single page, conditional rendering | No router; different views via store state; if username in localStorage skip entry | ✓ |
| React Router with named routes | Dedicated URLs per screen; better history/back-button; adds dependency | |

**User's choice:** Single page, conditional rendering
**Notes:** Consistent with a personal tool that doesn't need deep-linking.

---

**Q2: What views does Phase 2 need?**

| Option | Description | Selected |
|--------|-------------|----------|
| 3 views: Username entry → Loading → Comparison | Entry form, loading/polling screen, comparison screen | ✓ |
| 4 views: add a simple ranked list view | Ranked list alongside the 3 above | |

**User's choice:** 3 views
**Notes:** Ranked list is DISP-V2-01 (v2 deferred).

---

**Q3: Where do the comparison counter and Refresh button live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Counter in header, Refresh below cards | Header: username + counter; Skip + Refresh below cards | ✓ |
| All controls in a toolbar above the cards | Counter + Refresh + Skip in a top bar | |

**User's choice:** Counter in header, Refresh as secondary button below the cards
**Notes:** Keeps the comparison choice (the primary action) visually dominant.

---

**Q4: Visual style target for comparison screen?**

| Option | Description | Selected |
|--------|-------------|----------|
| Clean utility UI — functional, no polish | Tailwind defaults, no animations, build for correctness | ✓ |
| Minimal design intention | Some deliberate layout choices now, Phase 4 refines | |

**User's choice:** Clean utility UI
**Notes:** Phase 4 is the designated polish phase.

---

## Game Card Content

**Q1: What text fields should each comparison card show?**

| Option | Description | Selected |
|--------|-------------|----------|
| Name + year published | Year disambiguates duplicate names; in BGG XML | ✓ |
| Name only | Simplest | |
| Name + year + BGG average rating | Adds crowd-opinion context; potentially biases choices | |

**User's choice:** Name + year published

---

**Q2: Should the card show the game's current ranking position?**

| Option | Description | Selected |
|--------|-------------|----------|
| No — hide ranking during comparison | Pure preference-based; Phase 4 upset callout handles post-pick feedback | |
| Show rank position (#47) | Context about current standing; anchors decisions to existing ranking | ✓ |
| Show decimal rating (7.43) | Exposes internal score; feels like a spreadsheet | |

**User's choice:** Show rank position (#47 of N)
**Notes:** User wants ranking context visible during comparison. Rank derived from sorted array index at render time.

---

**Q3: Should Phase 2 parse and store thumbnail URL now?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — parse and store thumbnail URL now | Phase 4 reads it from CollectionState without re-fetch | ✓ |
| No — fetch thumbnail data in Phase 4 | Simpler Phase 2 scope; Phase 4 needs re-fetch or schema migration | |

**User's choice:** Yes — store thumbnail URL in Game type from day one

---

## Username Persistence

**Q1: Should the app remember username in localStorage?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — persist username in localStorage | Skip entry form on return; safe since username is not a credential | |
| No — require username every visit | Simpler state; always explicit session start | ✓ |

**User's choice:** No — require username every visit

---

**Q2: How to implement the PERSIST-02 username guard without persisting username separately?**

| Option | Description | Selected |
|--------|-------------|----------|
| Store username inside PersistedRankings only | Embedded in bgg-ranker:v1:rankings; compare on load | ✓ |
| Store username as separate session-only Zustand state | Username in memory only; rankings embed their own username field | |

**User's choice:** Username embedded in PersistedRankings only — not a separate localStorage key

---

**Q3: On matching username, what happens with stored rankings?**

| Option | Description | Selected |
|--------|-------------|----------|
| Load stored rankings + prompt to continue or re-fetch | User sees "Found N ranked games" with two buttons | ✓ |
| Auto-load stored rankings and go to comparison | Fastest path; assumes user always wants to resume | |
| Always re-fetch collection then merge | COLL-V2-01 (merge/reconciliation) is v2 deferred | |

**User's choice:** Prompt with "Continue ranking" or "Re-fetch collection" options

---

## Expansion Toggle (COLL-02)

**Q1: Expansion toggle mechanics — re-fetch or filter locally?**

| Option | Description | Selected |
|--------|-------------|----------|
| Filter locally — one fetch, two subsets | Store all with isExpansion flag; toggle shows/hides | |
| Re-fetch from BGG on toggle | Triggers 202 polling loop every toggle; slow UX | |

**User's response:** COLL-02 removed from v1 — update requirements to ignore expansions entirely. Fetch boardgames only.

---

**Q2 (follow-up): Should COLL-03 (rated unowned games) still be in Phase 2?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — keep COLL-03 | Two queries: own=1 and rated=1 (unowned); includes games played but not owned | ✓ |
| No — owned games only | Single query; unowned-but-rated deferred to v2 | |

**User's choice:** Keep COLL-03 in Phase 2

---

**Q3: Deduplication when game appears in both query results?**

| Option | Description | Selected |
|--------|-------------|----------|
| Deduplicate by objectid — owned entry wins | Simple set-union; owned record kept | ✓ (with log) |
| Deduplicate by objectid — last-fetched entry wins | Marginally simpler code; same outcome | |

**User's choice:** Owned entry wins; log at debug level that a duplicate was found and dropped

---

## Claude's Discretion

- Pair selection algorithm (RANK-02) — random selection strategy for the two-game comparison pair
- Skip queue implementation (RANK-04) — internal queue data structure for re-queuing skipped pairs
- Zustand slice structure — following ARCHITECTURE.md interfaces and CLAUDE.md partialize rules
- 202 polling parameters — 8 retries / 3s delay per CLAUDE.md guidelines

## Deferred Ideas

- **COLL-02 (expansion toggle)** — removed from v1, moved to v2 deferred
- **Ranked list view (DISP-V2-01)** — v2 deferred
- **Tier groupings in ranked list (DISP-V2-02)** — v2 deferred
