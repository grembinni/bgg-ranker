# BGG Proxy — Firebase Cloud Functions

This directory contains the Firebase Cloud Function that acts as the CORS proxy for production.

## Production Deployment

After deploying the Firebase Function (`firebase deploy --only functions`), copy the Function URL into `.env.production`:

```
VITE_BGG_API_BASE=https://us-central1-<YOUR_PROJECT_ID>.cloudfunctions.net/bgg
```

The URL format is: `https://us-central1-<FIREBASE_PROJECT_ID>.cloudfunctions.net/bgg`

You can find the URL in the Firebase Console under Functions, or in the deploy output.

## Setting VITE_BGG_API_BASE

In `.env.production`, set:

```
VITE_BGG_API_BASE=https://us-central1-<YOUR_PROJECT_ID>.cloudfunctions.net/bgg
```

In `.env.development`, this is already set to `/bggapi` (Vite dev proxy).

## Directory Structure

```
proxy/
└── functions/
    ├── src/
    │   └── index.ts        # Firebase Cloud Function (CORS proxy for BGG API)
    ├── package.json        # Firebase Functions dependencies
    ├── tsconfig.json       # TypeScript config for Functions
    └── lib/                # Compiled output (gitignored)
```

## Setup

1. Ensure your Firebase project is on the **Blaze (pay-as-you-go)** plan.
   The Spark free tier blocks outbound HTTP to external services (boardgamegeek.com).

2. Install Firebase CLI globally (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

3. Log in to Firebase:
   ```bash
   firebase login
   ```

4. Update `.firebaserc` with your actual project ID:
   Replace `YOUR_FIREBASE_PROJECT_ID` with your Firebase project ID from
   Firebase Console > Project Settings > General > Project ID.

5. Build and deploy:
   ```bash
   cd proxy/functions && npm run build && cd ../..
   firebase deploy --only functions
   ```

6. Copy the deployed Function URL to `.env.production`.

## Proxy Interface

The Function forwards all requests to BGG using the `?path=` query parameter:

- Collection read: `GET <FIREBASE_URL>?path=/xmlapi2/collection?username=X&own=1&subtype=boardgame`
- Login: `POST <FIREBASE_URL>?path=/login/api/v1`
- Rate a game: `POST <FIREBASE_URL>?path=/api/geekrating` with `X-BGG-Session` header

For authenticated write calls, the SPA sends the session token as `X-BGG-Session` header.
The Function reattaches it as `Cookie: sessionid=...` before forwarding to BGG.

## Session Token Handling (D-07)

The Firebase Function extracts BGG's `Set-Cookie` value from the login response and returns
it as a JSON field (`{ "sessionId": "..." }`). The SPA stores this in Zustand `SessionState`
(in-memory only, never written to localStorage — AUTH-03).

**Set-Cookie is never relayed to the SPA.** This sidesteps `HttpOnly` cookie restrictions
and satisfies AUTH-03 (credentials session-only, never persisted).

## Quick Verification

After deployment, verify the Function works:

```bash
curl "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/bgg?path=/xmlapi2/collection?username=boardgamegeek&own=1&subtype=boardgame" -v
```

Expected: HTTP 200 or 202 response with XML body.

Run the full prod smoke test:

```bash
FIREBASE_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/bgg \
BGG_USERNAME=your-bgg-username \
BGG_PASSWORD=your-bgg-password \
bash scripts/smoke-test-prod.sh
```
