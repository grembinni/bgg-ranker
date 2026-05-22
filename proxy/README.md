# BGG Proxy — Firebase Cloud Functions

This directory contains the Firebase Cloud Function that acts as the CORS proxy for production.

## Production Deployment

After deploying the Firebase Function (`firebase deploy --only functions`), copy the Function URL into `.env.production`:

```
VITE_BGG_API_BASE=https://<region>-<project>.cloudfunctions.net/bgg
```

The URL format is: `https://us-central1-<FIREBASE_PROJECT_ID>.cloudfunctions.net/bgg`

You can find the URL in the Firebase Console under Functions, or in the deploy output.

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

4. Set the Firebase project:
   ```bash
   firebase use <FIREBASE_PROJECT_ID>
   ```

5. Deploy:
   ```bash
   firebase deploy --only functions
   ```

6. Copy the deployed Function URL to `.env.production`.

## Proxy Interface

The Function forwards all requests to BGG using the `?path=` query parameter:

- Collection read: `GET /bgg?path=/xmlapi2/collection?username=X&own=1`
- Login: `POST /bgg?path=/login/api/v1`
- Rate a game: `POST /bgg?path=/api/geekrating` with `X-BGG-Session` header

For authenticated write calls (login → rate), the SPA sends the session token as `X-BGG-Session` header.
The Function reattaches it as `Cookie: sessionid=...` before forwarding to BGG.
