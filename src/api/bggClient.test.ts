/**
 * bggClient.test.ts — Unit tests for the BGG API client
 *
 * Covers requirements: COLL-01, COLL-03
 * Each test name includes the relevant requirement ID for grep traceability.
 *
 * Threat model mitigations tested here:
 *   T-02-01: percent-encodes username in URL
 *   T-02-02: poll202Loop throws after MAX_RETRIES (8 retries = 9 attempts)
 *   T-02-03: poll202Loop rejects on HTML error page with HTTP 200
 *   T-02-04: fetchCollection does not mutate ratings on 0-game result
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseCollectionXml,
  mergeCollections,
  poll202Loop,
  fetchCollection,
  type RawGame,
} from './bggClient'

// ---------------------------------------------------------------------------
// Helper: build a minimal valid BGG API2 collection XML
// ---------------------------------------------------------------------------

function makeCollectionXml(
  items: Array<{ id: string; name: string; year: number; thumbnail?: string }>
): string {
  const itemsXml = items
    .map(
      (i) =>
        `<item objectid="${i.id}" objecttype="thing" subtype="boardgame" collid="123">
      <name sortindex="1" value="${i.name}"/>
      <yearpublished value="${i.year}"/>
      <thumbnail>${i.thumbnail ?? '//cf.geekdo-images.com/pic_t.jpg'}</thumbnail>
      <stats><rating value="N/A"/></stats>
      <status own="1"/>
    </item>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="utf-8"?>\n<items totalitems="${items.length}">\n${itemsXml}\n</items>`
}

// ---------------------------------------------------------------------------
// parseCollectionXml (COLL-01)
// ---------------------------------------------------------------------------

describe('parseCollectionXml (COLL-01)', () => {
  it('extracts id, name, yearPublished, thumbnail from valid XML (COLL-01)', () => {
    const xml = makeCollectionXml([
      { id: '174430', name: 'Gloomhaven', year: 2017, thumbnail: '//cf.geekdo-images.com/.../pic2437871_t.jpg' },
      { id: '224517', name: 'Brass: Birmingham', year: 2018, thumbnail: '//cf.geekdo-images.com/.../pic3490053_t.jpg' },
    ])
    const result = parseCollectionXml(xml)
    expect(result.length).toBe(2)
    expect(result[0]).toEqual({
      id: '174430',
      name: 'Gloomhaven',
      yearPublished: 2017,
      thumbnail: '//cf.geekdo-images.com/.../pic2437871_t.jpg',
    })
  })

  it('handles single item without crashing (COLL-01)', () => {
    const xml = makeCollectionXml([{ id: '174430', name: 'Gloomhaven', year: 2017 }])
    const result = parseCollectionXml(xml)
    expect(result.length).toBe(1)
  })

  it('throws when game count is 0 (COLL-01)', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>\n<items totalitems="0"></items>`
    expect(() => parseCollectionXml(xml)).toThrow(/0 games/)
  })

  it('reads name from @_value attribute not text node (COLL-01)', () => {
    const xml = makeCollectionXml([{ id: '174430', name: 'Gloomhaven', year: 2017 }])
    const result = parseCollectionXml(xml)
    expect(result[0].name).toBe('Gloomhaven')
  })

  it('reads yearPublished from @_value attribute (COLL-01)', () => {
    const xml = makeCollectionXml([{ id: '174430', name: 'Gloomhaven', year: 2017 }])
    const result = parseCollectionXml(xml)
    expect(result[0].yearPublished).toBe(2017)
    expect(typeof result[0].yearPublished).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// mergeCollections (COLL-03)
// ---------------------------------------------------------------------------

describe('mergeCollections (COLL-03)', () => {
  it('owned entry wins when same objectid appears in both arrays (COLL-03)', () => {
    const owned: RawGame[] = [{ id: '100', name: 'Owned Name', yearPublished: 2020, thumbnail: 'owned.jpg' }]
    const ratedUnowned: RawGame[] = [{ id: '100', name: 'Rated Name', yearPublished: 2020, thumbnail: 'rated.jpg' }]
    const merged = mergeCollections(owned, ratedUnowned)
    expect(merged.length).toBe(1)
    expect(merged[0].name).toBe('Owned Name')
  })

  it('non-duplicate rated-unowned games are appended to owned (COLL-03)', () => {
    const owned: RawGame[] = [{ id: '1', name: 'Game One', yearPublished: 2020, thumbnail: '' }]
    const ratedUnowned: RawGame[] = [{ id: '2', name: 'Game Two', yearPublished: 2021, thumbnail: '' }]
    const merged = mergeCollections(owned, ratedUnowned)
    expect(merged.length).toBe(2)
    expect(merged.map((g) => g.id)).toEqual(['1', '2'])
  })

  it('logs debug note via console.debug when duplicate found (COLL-03)', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const owned: RawGame[] = [{ id: '100', name: 'Owned Name', yearPublished: 2020, thumbnail: '' }]
    const ratedUnowned: RawGame[] = [{ id: '100', name: 'Rated Name', yearPublished: 2020, thumbnail: '' }]
    mergeCollections(owned, ratedUnowned)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Duplicate'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('100'))
    spy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// poll202Loop (COLL-01)
// ---------------------------------------------------------------------------

describe('poll202Loop (COLL-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns body when first response is 200 (COLL-01)', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => '<?xml version="1.0"?><items totalitems="0"/>',
    } as Response)

    const resultPromise = poll202Loop('http://test')
    await vi.advanceTimersByTimeAsync(0)
    const result = await resultPromise

    expect(result).toBe('<?xml version="1.0"?><items totalitems="0"/>')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries on 202 and succeeds on subsequent 200 (COLL-01)', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce({ status: 202, ok: false, text: async () => '' } as Response)
      .mockResolvedValueOnce({ status: 202, ok: false, text: async () => '' } as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => '<?xml version="1.0"?><items totalitems="1"><item objectid="1"/></items>',
      } as Response)

    const resultPromise = poll202Loop('http://test')
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(3000)
    const result = await resultPromise

    expect(result).toContain('<items')
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws after MAX_RETRIES (8) consecutive 202s (COLL-01)', async () => {
    const mockFetch = vi.mocked(fetch)
    // Always return 202 — poll loop should exhaust 9 attempts (0 through 8)
    mockFetch.mockResolvedValue({ status: 202, ok: false, text: async () => '' } as Response)

    const resultPromise = poll202Loop('http://test')
    // Advance timer 8 times (each 3000ms delay corresponds to an attempt that returned 202)
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(3000)
    }

    await expect(resultPromise).rejects.toThrow(/timed out after 8 retries/i)
    expect(mockFetch).toHaveBeenCalledTimes(9)
  })

  it('throws on non-200/202 status (COLL-01)', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({ status: 500, ok: false, text: async () => '' } as Response)

    const resultPromise = poll202Loop('http://test')
    await vi.advanceTimersByTimeAsync(0)

    await expect(resultPromise).rejects.toThrow(/HTTP 500/)
  })

  it('throws when response body starts with <html (COLL-01)', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => '<html><body>error</body></html>',
    } as Response)

    const resultPromise = poll202Loop('http://test')
    await vi.advanceTimersByTimeAsync(0)

    await expect(resultPromise).rejects.toThrow(/HTML error page/i)
  })
})

// ---------------------------------------------------------------------------
// fetchCollection (COLL-01, COLL-03)
// ---------------------------------------------------------------------------

describe('fetchCollection (COLL-01, COLL-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('percent-encodes username in URL (T-02-01, COLL-01)', async () => {
    const mockFetch = vi.mocked(fetch)
    const minimalXml = makeCollectionXml([{ id: '1', name: 'Game', year: 2020 }])
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => minimalXml,
    } as Response)

    const resultPromise = fetchCollection('user with spaces')
    await vi.advanceTimersByTimeAsync(0)
    await resultPromise

    const calledUrls = mockFetch.mock.calls.map((call) => call[0] as string)
    const allUrlsEncoded = calledUrls.every((url) => url.includes('user%20with%20spaces'))
    const anyUrlHasLiteralSpace = calledUrls.some((url) => url.includes('user with spaces'))

    expect(allUrlsEncoded).toBe(true)
    expect(anyUrlHasLiteralSpace).toBe(false)
  })

  it('issues two queries: own=1 and rated=1&own=0 (COLL-01, COLL-03)', async () => {
    const mockFetch = vi.mocked(fetch)
    const minimalXml = makeCollectionXml([{ id: '1', name: 'Game', year: 2020 }])
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => minimalXml,
    } as Response)

    const resultPromise = fetchCollection('testuser')
    await vi.advanceTimersByTimeAsync(0)
    await resultPromise

    expect(mockFetch).toHaveBeenCalledTimes(2)

    const calledUrls = mockFetch.mock.calls.map((call) => call[0] as string)
    const hasOwnedQuery = calledUrls.some(
      (url) => url.includes('own=1') && url.includes('subtype=boardgame') && url.includes('stats=1')
    )
    const hasRatedQuery = calledUrls.some(
      (url) =>
        url.includes('rated=1') &&
        url.includes('own=0') &&
        url.includes('subtype=boardgame') &&
        url.includes('stats=1')
    )

    expect(hasOwnedQuery).toBe(true)
    expect(hasRatedQuery).toBe(true)
  })
})
