---
phase: 01-foundation
plan: 04
subsystem: infra
tags: [firebase, cloud-functions, cors-proxy, smoke-test, production]

# Dependency graph
requires:
  - 01-01 (scaffold, proxy/functions/.gitkeep, proxy/README.md)
  - 01-03 (smoke-test-dev.sh pattern reference)
provides:
  - Firebase Cloud Function CORS proxy for BGG API in production
  - proxy/functions/src/index.ts: onRequest bgg function (D-07 sessionId JSON, D-08 X-BGG-Session)
  - firebase.json and .firebaserc for Firebase project configuration
  - scripts/smoke-test-prod.sh: prod smoke test via FIREBASE_URL + ?path= pattern
affects: [phase-2-ui, phase-3-auth, phase-4-sync]

# Tech tracking
tech-stack:
  added:
    - firebase-functions@^7.0.0 (proxy/functions/package.json)
    - firebase-admin@^13.0.0 (proxy/functions/package.json)
    - typescript@^5.0.0 (proxy/functions devDep)
    - "@types/node@^20.0.0 (proxy/functions devDep)"
  patterns:
    - Firebase Functions v2 onRequest with cors:true option — CORS handled by Firebase SDK
    - ?path= query parameter convention for Firebase Function URL (no path rewriting)
    - D-07: sessionId extracted from Set-Cookie, returned as JSON body — never relay Set-Cookie
    - D-08: X-BGG-Session header from SPA reattached as Cookie: sessionid=... before BGG forward
    - node:https built-in for upstream BGG request forwarding (no additional HTTP library needed)

key-files:
  created:
    - proxy/functions/src/index.ts
    - proxy/functions/package.json
    - proxy/functions/tsconfig.json
    - proxy/functions/package-lock.json
    - firebase.json
    - .firebaserc
    - scripts/smoke-test-prod.sh
  modified:
    - proxy/README.md (added VITE_BGG_API_BASE instructions, ?path= interface, session handling docs)
  deleted:
    - proxy/functions/.gitkeep (replaced by actual Firebase Function files)

key-decisions:
  - "firebase.json source=proxy/functions (not default functions/) per Pitfall 7 — mismatched source causes silent deploy failure"
  - "firebase.json codebase=bgg-proxy for multi-codebase Firebase project support"
  - ".firebaserc placeholder YOUR_FIREBASE_PROJECT_ID — user replaces at deploy time"
  - "D-07: sessionId returned as JSON body { sessionId } — HttpOnly Set-Cookie cannot be read by browser JS"
  - "D-08: X-BGG-Session custom header pattern — SPA sends token, Function reattaches as Cookie"
  - "node:https built-in used for upstream request — no additional HTTP library; streams response body via pipe"
  - "Task 2 (Firebase deploy) is a human-action checkpoint — requires Firebase CLI authentication (browser OAuth) and Blaze plan confirmation"
  - "smoke-test-prod.sh uses ?path= pattern (not path rewriting) matching Firebase Function interface"
  - "Write path failure treated as [WARN] not [FAIL] — /api/geekrating is undocumented (Assumption A1)"

# Metrics
duration: ~30min (Tasks 1 and 3 complete; Task 2 awaits human action)
completed: 2026-05-22T22:10:46Z
---

# Phase 01 Plan 04: Firebase Cloud Function CORS Proxy Summary

**Firebase Cloud Function CORS proxy implemented with D-07 sessionId JSON extraction and D-08 X-BGG-Session header relay; production smoke test created; deploy awaiting human action (Firebase CLI auth + Blaze plan)**

## Performance

- **Duration:** ~30 min (automated tasks complete)
- **Started:** 2026-05-22T21:40:00Z
- **Completed (automated):** 2026-05-22T22:10:46Z
- **Tasks:** 2 of 3 complete (Task 2 awaiting human action)
- **Files created/modified:** 8

## Task Status

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Create Firebase Function source files and firebase.json | DONE | 5aa8eb7 |
| 2 | Install Firebase CLI, authenticate, and deploy the Function | AWAITING HUMAN ACTION | — |
| 3 | Create prod smoke test script (scripts/smoke-test-prod.sh) | DONE | 116d781 |

## Accomplishments

- `proxy/functions/src/index.ts` — Firebase Cloud Function (`bgg`) using `onRequest` from `firebase-functions/v2/https`
  - Forwards all HTTP methods to `boardgamegeek.com` via Node.js built-in `node:https`
  - D-07: Login path extracts `sessionid` from BGG's `Set-Cookie`, returns `{ sessionId }` JSON — Set-Cookie never relayed
  - D-08: `X-BGG-Session` header from SPA reattached as `Cookie: sessionid=...` for authenticated write calls
  - Non-login paths: relay safe headers (`content-type`, `content-length`, `cache-control`) and pipe response body
  - Error handler: `upstream.on('error')` returns `502 { error: message }`
- `firebase.json` — `source: proxy/functions`, `codebase: bgg-proxy` (Pitfall 7: correct source path)
- `.firebaserc` — Placeholder `YOUR_FIREBASE_PROJECT_ID` for user to replace at deploy time
- `proxy/functions/package.json` — `bgg-proxy-functions` with `firebase-functions ^7.0.0`, `firebase-admin ^13.0.0`
- `proxy/functions/tsconfig.json` — `commonjs` module, `strict: true`, `outDir: lib`
- `scripts/smoke-test-prod.sh` — Full prod smoke test:
  - Collection read via `FIREBASE_URL?path=/xmlapi2/collection?username=...` with 202 poll loop
  - Login via `FIREBASE_URL?path=/login/api/v1`, extracts `sessionId` from JSON body (D-07 pattern)
  - Write via `FIREBASE_URL?path=/api/geekrating` with `X-BGG-Session` header (D-08 pattern)
  - Session ID logged as length only; write failure is `[WARN]` not `[FAIL]`
- TypeScript compiles without errors: `cd proxy/functions && node_modules/.bin/tsc --noEmit` exits 0
- npm install completed; `proxy/functions/node_modules/firebase-functions` exists

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create Firebase Function source files | 5aa8eb7 | firebase.json, .firebaserc, proxy/functions/src/index.ts, proxy/functions/package.json, proxy/functions/tsconfig.json, proxy/README.md |
| 3 | Create prod smoke test | 116d781 | scripts/smoke-test-prod.sh |

## Checkpoint: Task 2 Awaiting Human Action

**Task 2 requires interactive human steps that cannot be automated:**

- Firebase CLI authentication uses browser-based OAuth (cannot be scripted)
- Blaze (pay-as-you-go) plan must be confirmed active in Firebase Console
- `.firebaserc` must be updated with actual project ID before deploy

**Steps for the user:**

1. Confirm Firebase project is on Blaze plan:
   `https://console.firebase.google.com/project/YOUR_PROJECT_ID/usage`

2. Install Firebase CLI (if not installed):
   ```
   npm install -g firebase-tools
   firebase --version
   ```

3. Authenticate and update project ID:
   ```
   firebase login
   ```
   Edit `.firebaserc`: replace `YOUR_FIREBASE_PROJECT_ID` with actual project ID.

4. Build and deploy:
   ```
   cd proxy/functions && npm run build && cd ../..
   firebase deploy --only functions
   ```

5. Record the Function URL in `.env.production`:
   ```
   VITE_BGG_API_BASE=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/bgg
   ```

6. Quick verify:
   ```
   curl "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/bgg?path=/xmlapi2/collection?username=boardgamegeek&own=1&subtype=boardgame" -v
   ```

**Resume signal:** Type "deployed" and paste the Firebase Function URL.
Or type "no-blaze" if Blaze plan is not active.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged main branch into worktree before executing**
- **Found during:** Plan start (pre-execution check)
- **Issue:** The worktree branch `worktree-agent-a33f6fcff4764eabb` was created from commit `b8fcde2` (plan phase), but plans 01-01 through 01-03 were merged to `main` after the worktree was created. The worktree had only CLAUDE.md and README.md — no scaffold, no proxy directory, no smoke-test-dev.sh.
- **Fix:** `git merge main --no-edit` (fast-forward) to bring in all prior plan work before executing Plan 04.
- **Impact:** Zero — fast-forward merge, no conflicts.
- **Committed in:** Merged commit (not a deviation commit; prerequisite to Task 1)

**2. [Rule 1 - Bug] Removed proxy/functions/.gitkeep**
- **Found during:** Task 1
- **Issue:** `proxy/functions/.gitkeep` was committed in Plan 01 as a directory placeholder. Creating real files in `proxy/functions/` alongside `.gitkeep` leaves an unnecessary placeholder.
- **Fix:** `git rm proxy/functions/.gitkeep` — removed as part of Task 1 commit.
- **Files modified:** proxy/functions/.gitkeep (deleted)
- **Committed in:** 5aa8eb7 (Task 1 commit)

## Known Stubs

- `.firebaserc` contains `YOUR_FIREBASE_PROJECT_ID` placeholder — intentional. User must replace with actual project ID before `firebase deploy`. This is documented in proxy/README.md and the Task 2 checkpoint instructions.
- `.env.production` has `VITE_BGG_API_BASE=` empty — intentional. User fills in after Firebase deploy.

## Threat Flags

None — all new surface areas are covered by the plan's threat model:
- T-04-01 (Set-Cookie relay): mitigated by D-07 implementation (sessionId JSON body only)
- T-04-03 (X-BGG-Session in Function logs): accepted for solo dev project
- T-04-04 (smoke test credential logging): mitigated (length-only logging, no password echo)
- T-04-06 (firebaserc project ID): mitigated (placeholder in VCS, actual value at deploy time)

## Self-Check: PASSED

- `proxy/functions/src/index.ts` exists: FOUND
- `proxy/functions/package.json` exists: FOUND
- `proxy/functions/tsconfig.json` exists: FOUND
- `firebase.json` exists with `source: proxy/functions`: FOUND
- `.firebaserc` exists: FOUND
- `scripts/smoke-test-prod.sh` exists and is executable: FOUND
- `proxy/functions/node_modules/firebase-functions` exists: FOUND
- `cd proxy/functions && node_modules/.bin/tsc --noEmit` exits 0: VERIFIED
- Task 1 commit 5aa8eb7: FOUND in git log
- Task 3 commit 116d781: FOUND in git log

---
*Phase: 01-foundation*
*Completed (automated tasks): 2026-05-22*
*Task 2 status: Awaiting human action (Firebase deploy)*
