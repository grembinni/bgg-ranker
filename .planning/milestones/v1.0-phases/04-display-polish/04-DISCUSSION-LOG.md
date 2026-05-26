# Phase 4: Display Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 4-Display Polish
**Areas discussed:** Upset threshold, Callout design, Cover art polish, Login/Nav

---

## Upset threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 5+ spots | Fires when winner jumps 5 or more positions | |
| 10+ spots | Only fires on dramatic reversals | |
| Any upset | Every time lower-ranked game beats higher-ranked one | ✓ |

**User's choice:** Any upset — no minimum threshold
**Notes:** Callout fires on every comparison where the winner was ranked below the loser.

---

## Callout text format

| Option | Description | Selected |
|--------|-------------|----------|
| "Moved up N spots" | Clean, factual, no game name | |
| "[Game] moved up N spots" | Includes winner's name | ✓ |
| You decide | Claude picks format | |

**User's choice:** Include the winner's game name in the callout text.
**Notes:** Handle singular/plural — "1 spot" vs "3 spots".

---

## Callout timing

| Option | Description | Selected |
|--------|-------------|----------|
| Next comparison | Clears when user picks next | |
| Dismiss button | User manually closes | |
| 5 seconds then auto-clear | Fades after 5s | ✓ |

**User's choice:** Auto-clear after 5 seconds.

---

## Callout placement

| Option | Description | Selected |
|--------|-------------|----------|
| Between cards and action buttons | Full-width row after grid, before action bar | ✓ |
| Fixed banner at top | Sticks above card grid | |
| Overlay toast (bottom-right) | Floating, no layout shift | |

**User's choice:** Between cards and action buttons.

---

## Callout visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Amber/yellow highlight | bg-amber-50, warm "exciting" tone | ✓ |
| Blue info style | Matches existing button accent | |
| You decide | Claude picks | |

**User's choice:** Amber yellow highlight.

---

## Cover art improvements

| Option | Description | Selected |
|--------|-------------|----------|
| Keep layout, add placeholder only | Minimal change | |
| Larger image + visual upgrade | Full card redesign | ✓ |
| Current layout is fine | No changes | |

**User's choice:** Larger image + visual upgrade.
**Notes:** h-48, keep square (object-contain), image wraps as link to boardgamegeek.com/boardgame/{id} opening in new tab. Cards show only rank number (e.g. `#47`) — drop "of N total".

---

## Missing thumbnail fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Gray placeholder box | Same h-48 area, bg-gray-100 | ✓ |
| Nothing (keep current) | Image area collapses | |

**User's choice:** Gray placeholder box.

---

## Login flow

| Option | Description | Selected |
|--------|-------------|----------|
| Username + password always required | Full login upfront | ✓ |
| Username only, auto-continue for same user | Keep username-only, smarter resume | |
| You decide | Claude interprets description | |

**User's choice:** Always require username + password to start. Session established upfront before collection load.

---

## Return visit behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-resume, no prompt | Same username + login → go straight to comparison | ✓ |
| Show brief confirmation | "Welcome back!" message | |
| Keep current prompt | Continue session? / Refetch? | |

**User's choice:** Auto-resume silently.

---

## Hamburger menu contents

| Option | Description | Selected |
|--------|-------------|----------|
| Logout | Clear session, return to login | ✓ |
| Refresh rankings | Full redistribution | ✓ |
| Sync to BGG | Move from header into hamburger | ✓ |

**User's choice:** All three — Sync to BGG, Refresh rankings, Logout.

---

## Hamburger position and header layout

**User's free-text:** "top left, counter in middle, username to the right"

**Decided:** Header layout → `[☰]` (top-left) | `[N this session · N total]` (center) | `[username]` (right).

---

## Claude's Discretion

None — user provided explicit answers for all areas.

## Deferred Ideas

None — discussion stayed within Phase 4 scope.
