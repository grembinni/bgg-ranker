// Render production CORS proxy for BGG. Ports vite.config.ts's proven 3-cookie
// relay (D-07) to Express, combined with the old Firebase Function's
// isLogin-branch routing shape — WITHOUT its single-cookie bug (D-07 fix).
import express from 'express'
import cors from 'cors'
import https from 'node:https'
import { sanitizeSessionToken, extractSessionId, buildSessionCookie } from './session.js'

const app = express()

app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }))
// Capture the body as a raw Buffer for every request (type: () => true means
// this single parser matches all content types, including none/GET). We
// forward bytes through unmodified rather than re-serializing — this is
// simpler and safer than chaining express.json()+express.text(), which would
// double-consume the request stream and silently drop the parsed body.
app.use(express.raw({ type: () => true, limit: '5mb' }))

// Module-scoped mutable cache: full cookie string from the last successful
// login (mirrors vite.config.ts's proxySession). Wiped on process
// restart/cold start — expected per 05-RESEARCH.md Pitfall 2; do NOT add
// persistent storage.
let proxySession = null

app.get('/healthz', (req, res) => {
  res.sendStatus(200)
})

app.use(async (req, res) => {
  const isLogin = req.path.startsWith('/login')

  const rawToken = req.headers['x-bgg-session']
  const xBggSession = sanitizeSessionToken(rawToken)

  // Fallback note: after a cold start proxySession is null and this degrades
  // to a SessionID-only cookie; the SPA's existing 401 -> reAuthAndResume
  // flow recovers — document, do not "fix".
  const cookieHeader = isLogin
    ? undefined
    : (proxySession ?? (xBggSession ? `SessionID=${xBggSession}` : undefined))

  // req.body is a raw Buffer (see express.raw() above) — forward bytes as-is.
  const bodyToSend = req.body && req.body.length > 0 ? req.body : undefined

  const options = {
    hostname: 'boardgamegeek.com', // hardcoded — never derived from client input (SSRF mitigation)
    path: req.originalUrl,
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'] || 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  }

  const upstream = https.request(options, (upstreamRes) => {
    if (isLogin) {
      // Native array via the https module — NEVER use fetch().get('set-cookie'),
      // which comma-merges cookies (05-RESEARCH.md Pitfall 1).
      const cookies = upstreamRes.headers['set-cookie']
      const sessionId = extractSessionId(cookies)
      if (sessionId) {
        proxySession = buildSessionCookie(cookies)
      }

      const body = JSON.stringify({ sessionId })
      // Drain upstream body first, then send our synthesized JSON response.
      upstreamRes.resume()
      upstreamRes.on('end', () => {
        // Always respond 200 on success: BGG's own status may be 204 (a 204
        // body is dropped by browser fetch) or 400 (bad credentials) — we
        // still synthesize a fresh JSON body regardless.
        const statusCode = upstreamRes.statusCode ?? 200
        res.writeHead(statusCode >= 200 && statusCode < 300 ? 200 : statusCode, {
          'content-type': 'application/json',
        })
        res.end(body)
      })
      return
    }

    // Non-login responses: relay status code unmodified (must pass a 202
    // through untouched per CLAUDE.md) and copy only an explicit header
    // allowlist — never blanket-relay, which would leak Set-Cookie.
    const safeHeaders = ['content-type', 'content-length', 'cache-control']
    const headersToSend = {}
    safeHeaders.forEach((h) => {
      if (upstreamRes.headers[h]) headersToSend[h] = upstreamRes.headers[h]
    })
    res.writeHead(upstreamRes.statusCode ?? 200, headersToSend)
    upstreamRes.pipe(res)
  })

  upstream.on('error', (err) => {
    res.status(502).json({ error: err.message })
  })

  if (bodyToSend !== undefined) {
    upstream.write(bodyToSend)
  }
  upstream.end()
})

// Render injects PORT — the service MUST bind to it or the deploy health
// check fails.
const PORT = process.env.PORT || 10000
app.listen(PORT, () => {
  console.log(`bgg-ranker-proxy listening on port ${PORT}`)
})
