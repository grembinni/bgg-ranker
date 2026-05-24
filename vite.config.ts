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
          cookieDomainRewrite: 'localhost',
          configure: (proxy) => {
            const devSession = env.BGG_DEV_SESSION
            proxy.on('proxyReq', (proxyReq) => {
              if (devSession) {
                proxyReq.setHeader('Cookie', devSession)
              }
            })
            proxy.on('proxyRes', (proxyRes, req: IncomingMessage, res: ServerResponse) => {
              const cookies = proxyRes.headers['set-cookie']

              // Intercept login responses — extract sessionid from Set-Cookie and rewrite
              // body to {sessionId: "..."} JSON (mirrors Firebase Function D-07, Pattern 6)
              if (req.url?.includes('/login/api/v1')) {
                const sessionCookie = (cookies ?? []).find((c) => c.startsWith('sessionid='))
                const sessionId = sessionCookie?.split(';')[0]?.replace('sessionid=', '') ?? ''

                const body = JSON.stringify({ sessionId })
                const statusCode = proxyRes.statusCode ?? 200

                // Override response headers — remove Set-Cookie; set JSON content-type
                res.writeHead(statusCode, {
                  'content-type': 'application/json',
                  'content-length': Buffer.byteLength(body).toString(),
                })

                // Consume the upstream body (required to prevent socket hang), then send ours
                proxyRes.resume()
                proxyRes.on('end', () => {
                  res.end(body)
                })
                return
              }

              // Non-login responses: remove Secure flag so HTTP localhost accepts cookie
              if (cookies) {
                proxyRes.headers['set-cookie'] = cookies.map((c) =>
                  c.replace(/;\s*Secure/i, '').replace(/domain=[^;]+/i, 'domain=localhost')
                )
              }
            })
          },
        },
      },
    },
  }
})
