# Domain Pitfalls

**Domain:** BGG collection ranking web app (XML API2 + localStorage + bell-curve ranker)
**Researched:** 2026-05-22
**Confidence:** MEDIUM — BGG API behavior based on documented community knowledge; IEEE 754 and browser storage specs are HIGH confidence.

---

## Critical Pitfalls

### C1: BGG Collection Endpoint Returns 202 — Not an Error

**What goes wrong:** BGG's `/collection` endpoint returns HTTP 202 on the first request while the server queues the fetch. An app that treats 202 as success gets empty XML. If that empty result is persisted to localStorage, it silently destroys all saved rankings.

**Prevention:**
- Check `response.status === 202` explicitly and enter a polling loop (wait 3s, retry up to 8 times, then surface an error).
- Never write to localStorage until a 200 response with `games.length > 0` is confirmed.
- Guard: if fetched game count is 0 and saved rankings exist, abort the merge and show an error.

**Detection:** Collection fetch appears to succeed but renders 0 games. Reproduces intermittently with large collections on first load.

**Phase:** Phase 1 — must be solved before any other API work.

---

### C2: CORS Proxy Strips Session Cookie — Login Works Locally, Breaks in Production

**What goes wrong:** The Vite dev proxy works but in production the deployed proxy strips `Set-Cookie` response headers from BGG's login response. Session cookie never reaches the browser. All write calls fail with 401.

**Prevention:**
- Choose and test the production proxy strategy in Phase 1 — never defer it.
- Proxy must explicitly forward `Cookie` upstream and `Set-Cookie` downstream.
- In dev, configure `cookieDomainRewrite: 'localhost'` in Vite proxy so BGG's `Set-Cookie` is accepted by the browser.
- Test the full cookie round-trip (login → cookie stored → rating write succeeds) against the deployed proxy before building any sync logic.

**Detection:** Login works locally but all sync calls fail in staging. `Set-Cookie` visible in proxy network tab but absent in browser Application > Cookies.

**Phase:** Phase 1 — validate cookie round-trip in deployed environment before Phase 2.

---

### C3: Collection Re-Fetch Overwrites Saved Rankings

**What goes wrong:** User re-authenticates or refreshes their collection. The app fetches a new game list and calls `initializeRankings(newGames)`, destroying all comparison history.

**Prevention:**
- Strictly separate "fetch collection metadata from BGG" from "initialize ranking state."
- Merge strategy: new games get random positions within the current tier structure; removed games are dropped and remaining respaced.
- `initializeRankings()` is called exactly once: when localStorage contains no valid ranking state for this user.
- "Reset all rankings" is an explicit user action with a confirmation dialog — the only code path to `initializeRankings()`.

**Detection:** Re-login resets all rankings in manual testing.

**Phase:** Must be designed before the first integration of collection fetch with ranking state.

---

### C4: Tier Capacity Overflow — 99-Value Hard Ceiling Per Tier

**What goes wrong:** At 2 decimal places, each tier holds at most 99 unique values (tier 9: 9.00 down to 8.01 = 99 slots). For large collections, the normalized 30%-weight center tier gets more games than available decimal slots. RANK-08 (unique ratings) becomes mathematically impossible.

**Math:** 30% weight × 2000 games = 600 games in the largest tier. 600 > 99. Maximum safe collection size with integer-internal storage = 990 games (99 × 10 tiers).

**Prevention:**
- Calculate max supportable collection size: `99 * tierCount`. Document 990 as the hard ceiling for 2-decimal precision.
- Add `validateTierCapacity(collectionSize, normalizedWeights)` called before every initialization and refresh. Fail loudly with a user-visible error, not silently.
- For collections exceeding the ceiling: warn user and refuse to initialize, or document as unsupported.

**Phase:** Ranking engine design — must be resolved before writing any spacing math.

---

### C5: Floating-Point Arithmetic Produces Non-Unique or Out-of-Tier Ratings

**What goes wrong:** Equally-spaced values computed as `tierMax - (index * step)` accumulate IEEE 754 error. Values like `8.009999999999998` appear instead of `8.01`. Two values may compare equal. `toFixed(2)` rounds inconsistently for values near `x.005`.

**Prevention:**
- Store all ratings internally as integers (`801` = 8.01, `900` = 9.00). Divide by 100 only when displaying or submitting to BGG.
- Use `Math.round(value * 100) / 100` — not `parseFloat(value.toFixed(2))`.
- Unit tests must assert: (a) `new Set(ratings).size === ratings.length` (all unique), (b) all values within `[tierMin*100, tierMax*100]` inclusive.

**Phase:** Ranking engine — integer-internal representation must be the first architectural decision.

---

## Moderate Pitfalls

### M1: BGG Returns HTML Error Page With HTTP 200

**What goes wrong:** When BGG is overloaded it returns an HTML error page with a 200 status code. `DOMParser` parses it; the app finds no `<items>` element and crashes or treats the collection as empty.

**Prevention:**
- After parsing, check `parsedDoc.querySelector('parsererror')` before accessing data elements.
- Check `parsedDoc.documentElement.tagName` — if it's `html` not `items`, treat as server error and retry.

**Phase:** Phase 1 API integration.

---

### M2: BGG Collection XML Omits Optional Fields Without Query Params

**What goes wrong:** Fields like `<stats>`, `<userrating>`, `<numplays>` are absent unless explicitly requested via query parameters (`?stats=1&rating=1`). Accessing absent elements returns null, producing NaN or crashes.

**Prevention:**
- Request all needed fields explicitly in the collection URL.
- Write a `parseGameItem(itemEl)` function with explicit fallbacks for every field.

**Phase:** Phase 1 API integration.

---

### M3: Bulk Rating Writes Trigger BGG Throttling

**What goes wrong:** 500 consecutive write requests with no delay triggers BGG throttling (429 or silent failures). User sees a broken sync with no explanation.

**Prevention:**
- 200–500ms delay between writes. For 500 games this means 1.5–4 minutes — communicate progress explicitly ("Syncing 47 / 500...").
- Diff against `lastSyncedRatings` and only write changed values to minimize request count.
- Exponential backoff on non-2xx responses.

**Phase:** BGG sync phase.

---

### M4: BGG Rating Write Endpoint Is Undocumented and Fragile

**What goes wrong:** The write endpoint for star ratings is not in the official BGG XML API2 spec. It is community-discovered and has changed historically.

**Prevention:**
- Isolate all write calls behind a single `bggRateGame(gameId, rating, sessionCookie)` adapter function.
- Test the write path manually before building batch sync logic.
- Log full HTTP response body on every write failure.

**Phase:** BGG sync phase — manual test first, batch sync second.

---

### M5: localStorage Quota Exceeded for Large Collections

**What goes wrong:** `localStorage.setItem` throws `QuotaExceededError` (5MB limit). The error is uncaught; ranking state silently fails to persist.

**Prevention:**
- Store only `{ id, name, rating }` per game. No image URLs, descriptions, or comparison history in localStorage.
- Wrap every `localStorage.setItem` in try/catch and surface quota errors to the user.

**Phase:** Persistence layer design.

---

### M6: Page Reload During Sync Leaves BGG in Partially Updated State

**What goes wrong:** User triggers sync of 200 games, reloads after 80 writes. BGG has 80 games with new ratings and 120 with old — a mixed state the user cannot detect.

**Prevention:**
- Store `lastSyncedRatings` snapshot in localStorage. Update it only on sync completion.
- On sync start, diff current ratings against `lastSyncedRatings` to identify only changed games.
- On app start, detect in-progress sync (partial state flag) and offer "Resume sync."

**Phase:** BGG sync phase.

---

### M7: Re-Authentication Must Not Block Access to Existing Rankings

**What goes wrong:** BGG session cookie is cleared on browser close. On reload, if auth is required before showing rankings, the user cannot see their data without re-entering credentials.

**Prevention:**
- Load rankings from localStorage immediately on app start, before checking auth state.
- Show rankings in read-only state if no valid session exists.
- Auth prompt appears only when the user initiates a write operation (sync) or fresh collection fetch.

**Phase:** Auth + persistence integration.

---

## Minor Pitfalls

### m1: No Skip Option Forces Artificial Choices

User genuinely cannot decide between two games. Forcing a pick erodes ranking quality. Make this a conscious product decision: add a "Skip this pair" button that defers the comparison.

**Phase:** Comparison UI phase.

---

### m2: Small Collections Break Tier Distribution

With 10 games and 10 tiers, many tiers get 0 games after rounding. A 1-game tier needs a defined assignment rule.

**Prevention:**
- Use the largest-remainder method for distributing rounding remainders.
- A tier with exactly 1 game gets `tierMax` (e.g., 9.00 for tier 9).
- Unit test collections of size 1, 5, 10, 11, 15.

**Phase:** Ranking engine.

---

### m3: BGG Collection Includes Expansions By Default

Comparing "Wingspan" against "Wingspan: European Expansion" is semantically wrong for a ranking app.

**Prevention:** Add `subtype=boardgame` to the collection URL from day one. Add "include expansions" as an explicit opt-in toggle.

**Phase:** Phase 1 API integration.

---

### m4: Tier 1 Lower Bound May Be Rejected by BGG

Tier 1 spans `[1.00, 0.01]` per RANK-06. BGG may reject ratings below 1.0.

**Prevention:** Clamp all submitted values to `[1.00, 10.00]`. Redefine tier 1 lower bound to `1.00` or verify the accepted range during Phase 1.

**Phase:** Phase 1 (verify range) + ranking engine boundary definition.

---

### m5: BGG Username Case Sensitivity

`?username=JeremyHurdle` vs `?username=jeremyhurdle` may behave differently on BGG's server.

**Prevention:** Store the username exactly as entered. Do not transform case.

**Phase:** Auth phase.

---

## Phase-Specific Summary

| Phase | Pitfall | Mitigation |
|---|---|---|
| CORS proxy setup | Proxy strips `Set-Cookie`; auth works locally only | Test cookie round-trip in deployed env before Phase 2 |
| Collection fetch | 202 treated as empty/success | Poll-retry loop is prerequisite for all API work |
| Collection fetch | HTML error page with 200 status | Check `<parsererror>` and `documentElement.tagName` |
| Collection fetch | Expansions pollute comparison set | Add `subtype=boardgame` filter from day one |
| Ranking engine design | Float precision produces non-unique ratings | Integer-internal representation from the start |
| Ranking engine design | Tier overflow for large collections (>990 games) | Calculate 99×tiers ceiling before writing spacing code |
| Ranking initialization | Re-fetch overwrites saved rankings | Strict merge-not-overwrite contract from first commit |
| Persistence | localStorage quota exceeded | Lean schema + try/catch every write |
| BGG sync | Undocumented write endpoint | Isolate behind single adapter; manual-test before batch |
| BGG sync | Bulk writes throttled | Per-write delay + progress indicator |
| BGG sync | Partial sync on page reload | `lastSyncedRatings` snapshot + resume-sync logic |
| Auth / reload | Session gone on reload blocks rankings | Load rankings before checking auth; gate only write ops |

---

## Items Requiring Live Verification in Phase 1

1. BGG write endpoint URL and exact request format (form vs JSON, exact field names)
2. BGG accepted rating range — does BGG reject values below 1.0?
3. BGG session cookie `Max-Age` / `Expires` — observe in DevTools during first auth implementation
4. BGG throttling threshold for rating writes — empirically test before building batch sync
