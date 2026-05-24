---
status: partial
phase: 02-collection-ranking
source: [02-VERIFICATION.md]
started: 2026-05-24T00:00:00Z
updated: 2026-05-24T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live BGG Collection Load with 202 Polling
expected: Run `npm run dev`, open http://localhost:5173, enter a real BGG username with a small collection. Loading view appears immediately with spinner. On success, view transitions to Comparison screen showing two game cards.

result: [pending]

### 2. Continue-or-Refetch Prompt (PERSIST-02)
expected: After loading a collection, reload the page. Re-enter the SAME username — the form shows "Found N ranked games from your last session." with "Continue ranking" and "Re-fetch collection" buttons. Entering a DIFFERENT username proceeds directly to a fresh fetch with no prompt.

result: [pending]

### 3. localStorage Contents Inspection (PERSIST-01, AUTH-03)
expected: DevTools → Application → Local Storage → key `bgg-ranker:v1:collection-and-rankings`. JSON contains exactly: `games`, `lastFetched`, `ratings`, `comparisonsTotal`, `rankingsUsername`, `version`. Does NOT contain: `sessionUsername`, `view`, `currentPair`, `skipQueue`, `loadingMessage`, `errorMessage`, `sessionComparisons`.

result: [pending]

### 4. Skip Queue Drain Order (RANK-04)
expected: Click Skip on a pair (A vs B). A new pair (C vs D) appears; counter unchanged. Click Pick on C vs D. The previously-skipped pair (A vs B) reappears as the next comparison.

result: [pending]

### 5. Counter Format and Persistence (RANK-05, PERSIST-01)
expected: After picking several games, counter shows `N this session · M total` with a visible middle dot (·). Reload → Continue ranking → counter shows `0 this session · M total` (session resets, total persists).

result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
