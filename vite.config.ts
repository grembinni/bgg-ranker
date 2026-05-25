import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/bggapi': {
          target: 'https://boardgamegeek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/bggapi/, ''),
          selfHandleResponse: true,  // prevents http-proxy from piping to res automatically (CR-04)
          configure: (proxy) => {
            const devSession = env.BGG_DEV_SESSION
            // Stores the full cookie string from the last successful login.
            // BGG requires all three cookies (SessionID + bggusername + bggpassword)
            // for private collection reads and writes.
            let proxySession: string | null = null

            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.url?.includes('/login/api/v1')) return
              // Remove X-BGG-Session — dev proxy injects the full stored cookie string instead.
              // (Production: Firebase Function handles X-BGG-Session separately.)
              const xBggSessionRaw = req.headers['x-bgg-session'] as string | undefined
              proxyReq.removeHeader('x-bgg-session')
              // Sanitize before cookie injection — reject values with chars outside [A-Za-z0-9_-]
              // to prevent CRLF or semicolon injection into the forwarded Cookie header (CR-02).
              const xBggSession = xBggSessionRaw && /^[A-Za-z0-9_-]+$/.test(xBggSessionRaw)
                ? xBggSessionRaw
                : undefined
              // Fallback: when proxySession is null (dev server restarted after login),
              // construct a minimal SessionID cookie from the X-BGG-Session header value.
              // This keeps write requests authenticated on the /api/geekrating path (T-03.1-01).
              const session = proxySession ?? devSession ?? (xBggSession ? `SessionID=${xBggSession}` : null)
              if (session) proxyReq.setHeader('Cookie', session)
            })
            proxy.on('proxyRes', (proxyRes, req: IncomingMessage, res: ServerResponse) => {
              const cookies = proxyRes.headers['set-cookie']

              // Intercept login responses — extract sessionid from Set-Cookie and rewrite
              // body to {sessionId: "..."} JSON (mirrors Firebase Function D-07, Pattern 6)
              if (req.url?.includes('/login/api/v1')) {
                const sessionCookie = (cookies ?? []).find((c) => /^sessionid=/i.test(c))
                const sessionId = sessionCookie?.split(';')[0]?.replace(/^sessionid=/i, '') ?? ''

                if (sessionId) {
                  // Store all non-deleted cookies for authenticated subsequent requests
                  proxySession = (cookies ?? [])
                    .filter((c) => !c.includes('Max-Age=0'))
                    .map((c) => c.split(';')[0])
                    .join('; ')
                }

                const body = JSON.stringify({ sessionId })
                // Drain upstream body first, then send our JSON response synchronously
                proxyRes.resume()
                proxyRes.on('end', () => {
                  // Always respond 200: we synthesize a new JSON body regardless of BGG's
                  // status code (which may be 204 on success, 400 on bad credentials).
                  // A 204 body would be silently dropped by the browser's fetch API.
                  const statusCode = proxyRes.statusCode ?? 200
                  res.writeHead(statusCode >= 200 && statusCode < 300 ? 200 : statusCode, {
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(body).toString(),
                  })
                  res.end(body)
                })
                return
              }

              // Non-login responses: rewrite cookies and pipe upstream to client manually
              // (required because selfHandleResponse: true disables auto-piping)
              if (cookies) {
                proxyRes.headers['set-cookie'] = cookies.map((c) =>
                  c.replace(/;\s*Secure/i, '').replace(/domain=[^;]+/i, 'domain=localhost')
                )
              }
              res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers)
              proxyRes.pipe(res)
            })
          },
        },
      },
    },
  }
})
