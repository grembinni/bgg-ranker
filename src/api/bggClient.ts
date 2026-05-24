/**
 * bggClient.ts — BGG XML API2 client with 202 polling and two-query merge.
 *
 * This is the ONLY module that imports `fetch` and `XMLParser`.
 * UI components never import from this file (per CLAUDE.md).
 * All functions return integer/string primitives (no Date objects, no Decimal types).
 */

import { XMLParser } from 'fast-xml-parser'

export const BGG_API_BASE = import.meta.env.VITE_BGG_API_BASE as string

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 8
const RETRY_DELAY_MS = 3000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawGame {
  id: string
  name: string
  yearPublished: number
  thumbnail: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// parseCollectionXml
// ---------------------------------------------------------------------------

/**
 * parseCollectionXml — Parse BGG XML API2 collection response into RawGame[].
 *
 * @param xmlText - Raw XML text from BGG API2 collection endpoint
 * @returns Array of RawGame objects
 * @throws Error if parsed game count is 0
 */
export function parseCollectionXml(xmlText: string): RawGame[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (_name, jPath) => jPath === 'items.item',
  })

  const parsed = parser.parse(xmlText) as Record<string, unknown>
  const itemsEl = parsed?.['items'] as Record<string, unknown> | undefined
  const items: unknown[] = (itemsEl?.['item'] as unknown[]) ?? []

  const games = items
    .map((item) => {
      const it = item as Record<string, unknown>
      const nameEl = it['name'] as Record<string, unknown> | undefined
      return {
        id: String(it['@_objectid'] ?? ''),
        name: String(nameEl?.['#text'] ?? ''),
        yearPublished: Number(it['yearpublished'] ?? 0),
        thumbnail: String(it['thumbnail'] ?? ''),
      }
    })
    .filter((g) => g.id !== '' && g.name !== '')

  if (games.length === 0) {
    throw new Error('BGG returned 0 games — not writing to localStorage')
  }

  return games
}

// ---------------------------------------------------------------------------
// mergeCollections
// ---------------------------------------------------------------------------

/**
 * mergeCollections — Merge owned and rated-unowned game arrays, owned entry wins on duplicate.
 *
 * @param owned - Games the user owns
 * @param ratedUnowned - Games the user has rated but does not own
 * @returns Merged array with owned entries first; duplicates removed (owned wins)
 */
export function mergeCollections(owned: RawGame[], ratedUnowned: RawGame[]): RawGame[] {
  const ownedIds = new Set(owned.map((g) => g.id))
  const filtered = ratedUnowned.filter((g) => {
    if (ownedIds.has(g.id)) {
      console.debug(`[bggClient] Duplicate objectid=${g.id}: owned entry kept, rated-unowned dropped`)
      return false
    }
    return true
  })
  return [...owned, ...filtered]
}

// ---------------------------------------------------------------------------
// poll202Loop
// ---------------------------------------------------------------------------

/**
 * poll202Loop — Fetch a URL, retrying on HTTP 202 up to MAX_RETRIES times.
 *
 * @param url - Fully constructed URL to poll
 * @returns XML text body on success
 * @throws Error on timeout, HTTP error, or HTML error page
 */
export async function poll202Loop(url: string): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url)

    if (res.status === 202) {
      if (attempt === MAX_RETRIES) {
        throw new Error('BGG collection fetch timed out after 8 retries')
      }
      await delay(RETRY_DELAY_MS)
      continue
    }

    if (!res.ok) {
      throw new Error('BGG API error: HTTP ' + res.status)
    }

    const text = await res.text()
    if (text.trim().toLowerCase().startsWith('<html')) {
      throw new Error('BGG returned HTML error page instead of XML')
    }
    return text
  }

  throw new Error('Poll loop exhausted')
}

// ---------------------------------------------------------------------------
// bggLogin
// ---------------------------------------------------------------------------

/**
 * bggLogin — Authenticate with BGG and return a session token.
 *
 * In development the Vite proxy intercepts the /login/api/v1 response, extracts
 * the sessionid from Set-Cookie, and returns {sessionId: "..."} as a JSON body —
 * identical to what the Firebase Function does in production (D-07, Pattern 1, Pitfall 1).
 *
 * @param username - BGG username
 * @param password - BGG password (ephemeral — never stored outside Zustand; AUTH-03)
 * @returns {sessionId} — token to pass to bggRateGame as X-BGG-Session header
 * @throws Error on non-2xx or when sessionId is absent from response body
 */
export async function bggLogin(
  username: string,
  password: string
): Promise<{ sessionId: string }> {
  const res = await fetch(`${BGG_API_BASE}/login/api/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials: { username, password } }),
  })

  if (!res.ok) {
    throw new Error('BGG login failed: HTTP ' + res.status)
  }

  const data = (await res.json()) as { sessionId?: string }
  if (!data.sessionId) {
    throw new Error('BGG login failed: no sessionId in response')
  }

  return { sessionId: data.sessionId }
}

// ---------------------------------------------------------------------------
// bggRateGame
// ---------------------------------------------------------------------------

/**
 * bggRateGame — Write a single game rating to BGG via the undocumented geekrating endpoint.
 *
 * ratingInt is integer-internal (e.g. 743 = 7.43). The float conversion happens
 * here — never stored or passed as a float anywhere else (D-10).
 *
 * @param gameId - BGG objectid string
 * @param ratingInt - Integer-internal rating (e.g. 743 represents 7.43)
 * @param sessionId - Session token from bggLogin; sent as X-BGG-Session header (D-18)
 * @throws Error with .status property on non-2xx response (caller detects 401 for session-expired)
 */
export async function bggRateGame(
  gameId: string,
  ratingInt: number,
  sessionId: string
): Promise<void> {
  // Convert integer-internal rating to 2-decimal float at write time only (D-10)
  const ratingFloat = (ratingInt / 100).toFixed(2)

  const body = new URLSearchParams({
    objectid: gameId,
    objecttype: 'thing',
    rating: ratingFloat,
  })

  const res = await fetch(`${BGG_API_BASE}/api/geekrating`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-BGG-Session': sessionId,
    },
    body: body.toString(),
  })

  if (!res.ok) {
    // Attach .status so caller can detect 401 session-expired (D-18, Pattern 2)
    throw Object.assign(new Error('BGG write failed: HTTP ' + res.status), {
      status: res.status,
    })
  }
}

// ---------------------------------------------------------------------------
// fetchCollection
// ---------------------------------------------------------------------------

/**
 * fetchCollection — Fetch and merge a user's owned and rated-unowned games from BGG API2.
 *
 * @param username - BGG username (raw, not yet percent-encoded)
 * @returns Merged RawGame[] array
 * @throws Propagates errors from poll202Loop and parseCollectionXml
 */
export async function fetchCollection(username: string): Promise<RawGame[]> {
  const u = encodeURIComponent(username)

  const ownedUrl = `${BGG_API_BASE}/xmlapi2/collection?username=${u}&own=1&subtype=boardgame&excludesubtype=boardgameexpansion&stats=1`
  const ratedUrl = `${BGG_API_BASE}/xmlapi2/collection?username=${u}&rated=1&own=0&subtype=boardgame&excludesubtype=boardgameexpansion&stats=1`

  const [ownedXml, ratedXml] = await Promise.all([
    poll202Loop(ownedUrl),
    poll202Loop(ratedUrl),
  ])

  const owned = parseCollectionXml(ownedXml)

  // An empty rated-unowned result is valid — user may not have rated any unowned games.
  // Catch the 0-game throw from the secondary query only; owned-query errors still propagate.
  let ratedUnowned: RawGame[]
  try {
    ratedUnowned = parseCollectionXml(ratedXml)
  } catch {
    ratedUnowned = []
  }

  return mergeCollections(owned, ratedUnowned)
}
