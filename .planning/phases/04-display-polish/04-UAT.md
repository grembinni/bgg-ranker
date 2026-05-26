---
status: complete
phase: 04-display-polish
source: [04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-05-26T00:00:00Z
updated: 2026-05-26T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Comparison header layout
expected: The comparison screen header has a hamburger (☰) menu button on the left, comparison counter centered, and your username on the right. No standalone "Sync to BGG" or "Refresh" buttons are visible directly in the header — only the hamburger icon.
result: pass

### 2. Game cover art displayed
expected: Both game cards in a comparison show a 192px tall image of the game's BGG cover art. For games with no thumbnail, a gray box containing "No image" text appears instead.
result: pass

### 3. Thumbnail opens BGG page
expected: Clicking a game's cover art image opens `boardgamegeek.com/boardgame/{ID}` in a new browser tab. The current tab stays on the comparison screen.
result: pass

### 4. Upset callout — low-ranked game wins
expected: After picking the lower-ranked game (the one with the higher # rank number) to defeat a notably higher-ranked opponent, an amber/yellow callout appears below the card grid. It says something like "[Game Name] moved up N spot(s)". For a normal pick (winner already ranked above loser) no callout appears.
result: pass

### 5. Upset callout auto-clears
expected: After an upset callout appears, it disappears on its own after approximately 5 seconds without any interaction. Making the next comparison pick also clears it immediately.
result: pass

### 6. Hamburger dropdown contents
expected: Clicking the hamburger (☰) button opens a dropdown with exactly three items: "Sync to BGG", "Refresh rankings", and "Logout". Clicking outside the menu (or clicking any item) closes it.
result: pass

### 7. Logout returns to login screen
expected: Clicking Logout in the hamburger dropdown returns you to the login form (username + password fields). Your ranking data is preserved — you can verify this by logging back in with the same username.
result: pass

### 8. Auto-resume after re-login (same username)
expected: After logging out, log back in with the same username and password. Instead of re-fetching your full collection from BGG, the app should immediately resume your previous session — same games, same comparison count, no loading delay. You should land directly on the comparison screen with your existing rankings.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
