// Pure cookie-parsing helpers for the Render proxy's BGG session relay.
// Ported verbatim from vite.config.ts's proven dev-proxy logic (D-07) —
// BGG requires all three cookies (SessionID + bggusername + bggpassword)
// for private collection reads and writes.

// Rejects anything outside [A-Za-z0-9_-] to prevent CRLF/header injection
// into the outbound Cookie header (CR-02 / T-05-01). Do NOT weaken this regex.
export function sanitizeSessionToken(raw) {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]+$/.test(raw) ? raw : undefined
}

// Given an array of raw Set-Cookie strings, finds the sessionid cookie and
// returns its value (case-insensitive match), or '' when absent.
export function extractSessionId(setCookieArray) {
  const cookies = setCookieArray ?? []
  const sessionCookie = cookies.find((c) => /^sessionid=/i.test(c))
  return sessionCookie?.split(';')[0]?.replace(/^sessionid=/i, '') ?? ''
}

// Filters out Max-Age=0 (deletion) entries, strips cookie attributes down to
// name=value pairs, and joins for use as a single outbound Cookie header.
export function buildSessionCookie(setCookieArray) {
  const cookies = setCookieArray ?? []
  return cookies
    .filter((c) => !c.includes('Max-Age=0'))
    .map((c) => c.split(';')[0])
    .join('; ')
}
