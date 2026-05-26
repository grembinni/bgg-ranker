import { onRequest } from 'firebase-functions/v2/https'
import * as https from 'node:https'
import * as http from 'node:http'

// Forward all requests to BGG — path extracted from req.path after the function prefix
// Example: GET https://<fn-url>/bgg/xmlapi2/collection?username=X
export const bgg = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
    const targetPath = req.path || '/'
    const isLogin = targetPath.startsWith('/login')

    const options: https.RequestOptions = {
      hostname: 'boardgamegeek.com',
      path: targetPath,
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        // Re-attach session cookie for authenticated write calls (D-08)
        ...(req.headers['x-bgg-session']
          ? { Cookie: `sessionid=${req.headers['x-bgg-session']}` }
          : {}),
      },
    }

    const upstream = https.request(options, (upstreamRes: http.IncomingMessage) => {
      if (isLogin) {
        // Extract sessionid from Set-Cookie and return as JSON body (D-07)
        // Never relay Set-Cookie to the SPA — HttpOnly cookies cannot be read by browser JS
        const cookies = upstreamRes.headers['set-cookie'] || []
        const sessionCookie = cookies.find((c) => c.startsWith('sessionid='))
        const sessionId = sessionCookie?.split(';')[0]?.replace('sessionid=', '') || ''
        res.status(upstreamRes.statusCode || 200).json({ sessionId })
      } else {
        res.status(upstreamRes.statusCode || 200)
        // Relay only safe headers — never relay Set-Cookie for non-login paths either
        const safeHeaders = ['content-type', 'content-length', 'cache-control']
        safeHeaders.forEach((h) => {
          if (upstreamRes.headers[h]) res.setHeader(h, upstreamRes.headers[h]!)
        })
        upstreamRes.pipe(res)
      }
    })

    upstream.on('error', (err: Error) => {
      res.status(502).json({ error: err.message })
    })

    if (req.body) {
      upstream.write(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    }
    upstream.end()
  }
)
