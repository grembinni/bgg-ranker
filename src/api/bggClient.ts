import { XMLParser } from 'fast-xml-parser'

export const BGG_API_BASE: string = import.meta.env.VITE_BGG_API_BASE ?? ''

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

if (import.meta.env.DEV && !BGG_API_BASE) {
  console.warn('[bggClient] VITE_BGG_API_BASE is not set — all API calls will fail')
}

const MAX_RETRIES = 8
const RETRY_DELAY_MS = 3000

export interface RawGame {
  id: string
  collId: string             // BGG collection-item ID — used for PUT /api/collectionitem/{collId}
  name: string
  yearPublished: number
  thumbnail: string
  userRating: number | null  // BGG personal rating (1-10), null if unrated
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
      const statsEl = it['stats'] as Record<string, unknown> | undefined
      const ratingEl = statsEl?.['rating'] as Record<string, unknown> | undefined
      const ratingVal = ratingEl?.['@_value']
      const userRating =
        typeof ratingVal === 'number'
          ? ratingVal
          : typeof ratingVal === 'string' && ratingVal !== 'N/A'
            ? parseFloat(ratingVal)
            : null
      return {
        id: String(it['@_objectid'] ?? ''),
        collId: String(it['@_collid'] ?? ''),
        name: decodeHtmlEntities(String(nameEl?.['#text'] ?? '')),
        yearPublished: Number(it['yearpublished'] ?? 0),
        thumbnail: String(it['thumbnail'] ?? ''),
        userRating: userRating !== null && !isNaN(userRating) ? userRating : null,
      }
    })
    .filter((g) => g.id !== '' && g.name !== '')

  if (games.length === 0) {
    throw new Error('BGG returned 0 games — not writing to localStorage')
  }

  return games
}

// Merge owned and rated-unowned arrays; owned entry wins on duplicate objectid.
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

// Fetch a URL, retrying on HTTP 202 up to MAX_RETRIES times.
export async function poll202Loop(url: string, init?: RequestInit): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, init)

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

// Authenticate with BGG and return a session token.
// The Vite proxy (dev) and Cloudflare Worker (prod) extract sessionid from Set-Cookie and return it as JSON.
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

// Write a single game rating to BGG. ratingInt is integer-internal (743 = 7.43); null removes the rating.
export async function bggRateGame(
  collId: string,
  objectId: string,
  ratingInt: number | null,
  sessionId: string
): Promise<void> {
  // null → send rating 0 which removes the game's rating from BGG
  const rating = ratingInt === null ? 0 : ratingInt / 100

  const res = await fetch(`${BGG_API_BASE}/api/collectionitem/${collId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-BGG-Session': sessionId,
    },
    body: JSON.stringify({
      item: {
        collid: collId,
        objecttype: 'thing',
        objectid: objectId,
        rating,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[bggRateGame] HTTP ${res.status} for collId ${collId} (objectId ${objectId}):`, text.slice(0, 200))
    throw Object.assign(new Error('BGG write failed: HTTP ' + res.status), {
      status: res.status,
      body: text.slice(0, 120),
    })
  }
}

// Fetch and merge a user's owned and rated-unowned games from BGG API2.
export async function fetchCollection(username: string, sessionId?: string): Promise<RawGame[]> {
  const u = encodeURIComponent(username)

  const ownedUrl = `${BGG_API_BASE}/xmlapi2/collection?username=${u}&own=1&subtype=boardgame&excludesubtype=boardgameexpansion&stats=1`
  const ratedUrl = `${BGG_API_BASE}/xmlapi2/collection?username=${u}&rated=1&own=0&subtype=boardgame&excludesubtype=boardgameexpansion&stats=1`
  const init: RequestInit | undefined = sessionId
    ? { headers: { 'X-BGG-Session': sessionId } }
    : undefined

  const [ownedXml, ratedXml] = await Promise.all([
    poll202Loop(ownedUrl, init),
    poll202Loop(ratedUrl, init),
  ])

  const owned = parseCollectionXml(ownedXml)

  // An empty rated-unowned result is valid — user may have no rated unowned games.
  // Only catch the secondary query's 0-game error; owned-query errors still propagate.
  let ratedUnowned: RawGame[]
  try {
    ratedUnowned = parseCollectionXml(ratedXml)
  } catch {
    ratedUnowned = []
  }

  return mergeCollections(owned, ratedUnowned)
}
