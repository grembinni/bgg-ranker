import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../api/bggClient', () => ({
  fetchCollection: vi.fn(),
  bggLogin: vi.fn(),
  bggRateGame: vi.fn(),
}))

import { fetchCollection as mockBggFetch, bggLogin as mockBggLogin, bggRateGame as mockBggRateGame } from '../api/bggClient'
import { createAppStore, selectRandomPair, type Game } from './store'

function createMockStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string): string | null => store[k] ?? null,
    setItem: (k: string, v: string): void => { store[k] = v },
    removeItem: (k: string): void => { delete store[k] },
    _dump: (): Record<string, string> => ({ ...store }),
  }
}

function makeGames(n: number): Record<string, Game> {
  const games: Record<string, Game> = {}
  for (let i = 0; i < n; i++) {
    games[`g${i}`] = {
      id: `g${i}`,
      collId: `coll-g${i}`,
      name: `Game ${i}`,
      yearPublished: 2000 + i,
      thumbnail: '',
    }
  }
  return games
}

function makeRatings(n: number): Record<string, number> {
  const ratings: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    ratings[`g${i}`] = 1000 - i * Math.floor(1000 / (n + 1))
  }
  return ratings
}

beforeEach(() => {
  vi.mocked(mockBggFetch).mockReset()
  vi.mocked(mockBggLogin).mockReset()
  vi.mocked(mockBggRateGame).mockReset()
})

function setupStoreWithGames(
  games: Record<string, Game>,
  ratings?: Record<string, number>,
  rankingsUsername: string | null = null
) {
  const store = createAppStore(createMockStorage())
  store.setState({ games, ratings: ratings ?? {}, rankingsUsername })
  return store
}

describe('fetchCollection action (RANK-01, COLL-01, PERSIST-02)', () => {
  it('calls initializeRankings and seeds integer ratings on first load for this user (RANK-01)', async () => {
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', collId: 'c0', name: 'A', yearPublished: 2020, thumbnail: '', userRating: 7 },
      { id: 'g1', collId: 'c1', name: 'B', yearPublished: 2021, thumbnail: '', userRating: 8 },
      { id: 'g2', collId: 'c2', name: 'C', yearPublished: 2022, thumbnail: '', userRating: 6 },
      { id: 'g3', collId: 'c3', name: 'D', yearPublished: 2023, thumbnail: '', userRating: 5 },
      { id: 'g4', collId: 'c4', name: 'E', yearPublished: 2024, thumbnail: '', userRating: 9 },
    ])

    const store = createAppStore(createMockStorage())
    await store.getState().fetchCollection('alice')

    const state = store.getState()
    const ratingValues = Object.values(state.ratings)

    expect(ratingValues.length).toBe(5)
    ratingValues.forEach((v) => {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(100)
      expect(v).toBeLessThanOrEqual(1000)
    })
    expect(new Set(ratingValues).size).toBe(5)
    expect(state.rankingsUsername).toBe('alice')
    expect(state.view).toBe('comparison')
    expect(state.currentPair).not.toBeNull()
    expect(state.currentPair![0]).not.toBe(state.currentPair![1])
  })

  it('does not re-dirty games on load when their computed rating matches lastSyncedRatings', async () => {
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', collId: 'c0', name: 'A', yearPublished: 2020, thumbnail: '', userRating: 7 },
      { id: 'g1', collId: 'c1', name: 'B', yearPublished: 2021, thumbnail: '', userRating: 8 },
    ])

    const store = createAppStore(createMockStorage())

    // Simulate a previous full sync: compute what the app would assign and store as lastSyncedRatings
    const tempStore = createAppStore(createMockStorage())
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', collId: 'c0', name: 'A', yearPublished: 2020, thumbnail: '', userRating: 7 },
      { id: 'g1', collId: 'c1', name: 'B', yearPublished: 2021, thumbnail: '', userRating: 8 },
    ])
    await tempStore.getState().fetchCollection('alice')
    const syncedRatings = tempStore.getState().ratings

    store.setState({ lastSyncedRatings: syncedRatings } as Parameters<typeof store.setState>[0])
    await store.getState().fetchCollection('alice')

    expect(store.getState().dirtyGameIds).toEqual([])
  })

  it('marks games dirty on load iff their app-computed rating differs from BGG rating', async () => {
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', collId: 'c0', name: 'A', yearPublished: 2020, thumbnail: '', userRating: 7 },
      { id: 'g1', collId: 'c1', name: 'B', yearPublished: 2021, thumbnail: '', userRating: 8 },
      { id: 'g2', collId: 'c2', name: 'C', yearPublished: 2022, thumbnail: '', userRating: 6 },
      { id: 'g3', collId: 'c3', name: 'D', yearPublished: 2023, thumbnail: '', userRating: 5 },
      { id: 'g4', collId: 'c4', name: 'E', yearPublished: 2024, thumbnail: '', userRating: 9 },
    ])
    const store = createAppStore(createMockStorage())
    await store.getState().fetchCollection('alice')

    const state = store.getState()
    for (const [id, appRating] of Object.entries(state.ratings)) {
      const bggInt = Math.round((state.games[id].userRating as number) * 100)
      if (appRating !== bggInt) {
        expect(state.dirtyGameIds).toContain(id)
      } else {
        expect(state.dirtyGameIds).not.toContain(id)
      }
    }
  })

  it('always proceeds to fetch even when rankingsUsername matches — PERSIST-02 guard moved to login()', async () => {
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', name: 'Game 0', yearPublished: 2020, thumbnail: '', userRating: null },
      { id: 'g1', name: 'Game 1', yearPublished: 2021, thumbnail: '', userRating: null },
    ])

    const store = createAppStore(createMockStorage())
    store.setState({
      rankingsUsername: 'alice',
      ratings: { g0: 500, g1: 600 },
      games: makeGames(2),
    })

    await store.getState().fetchCollection('alice')

    expect(vi.mocked(mockBggFetch)).toHaveBeenCalledWith('alice', undefined)
    expect(store.getState().view).toBe('comparison')
  })

  it('discards stored rankings and reseeds when entered username differs from rankingsUsername (PERSIST-02)', async () => {
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'new0', collId: 'c0', name: 'New Game 0', yearPublished: 2020, thumbnail: '', userRating: 7 },
      { id: 'new1', collId: 'c1', name: 'New Game 1', yearPublished: 2021, thumbnail: '', userRating: 8 },
      { id: 'new2', collId: 'c2', name: 'New Game 2', yearPublished: 2022, thumbnail: '', userRating: 6 },
    ])

    const store = createAppStore(createMockStorage())
    store.setState({
      rankingsUsername: 'bob',
      ratings: { g0: 500 },
      games: makeGames(1),
    })

    await store.getState().fetchCollection('alice')

    expect(vi.mocked(mockBggFetch)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(mockBggFetch)).toHaveBeenCalledWith('alice', undefined)

    const state = store.getState()
    expect(state.rankingsUsername).toBe('alice')
    expect(Object.keys(state.ratings).length).toBe(3)
    expect('g0' in state.ratings).toBe(false)
  })

  it('sets view to error and does NOT mutate ratings when collection exceeds 990 games (RANK-10/COLL-01)', async () => {
    const manyGames = Array.from({ length: 991 }, (_, i) => ({
      id: `game${i}`,
      collId: `c${i}`,
      name: `Game ${i}`,
      yearPublished: 2000,
      thumbnail: '',
      userRating: 7,
    }))
    vi.mocked(mockBggFetch).mockResolvedValueOnce(manyGames)

    const store = createAppStore(createMockStorage())
    store.setState({ ratings: { existing: 500 }, rankingsUsername: 'alice' })

    await store.getState().fetchCollection('alice')

    const state = store.getState()
    expect(state.view).toBe('error')
    expect(state.errorMessage).toBeTruthy()
    expect(state.errorMessage).toContain('990')
    expect(state.ratings.existing).toBe(500)
    expect(state.rankingsUsername).toBe('alice')
  })

  it('sets view to error and does NOT mutate ratings when bggClient throws (COLL-01, T-02-04)', async () => {
    vi.mocked(mockBggFetch).mockRejectedValueOnce(
      new Error('BGG returned 0 games — not writing to localStorage')
    )

    const store = createAppStore(createMockStorage())
    store.setState({ ratings: { existing: 500 }, rankingsUsername: 'other' })

    await store.getState().fetchCollection('alice')

    const state = store.getState()
    expect(state.view).toBe('error')
    expect(state.errorMessage).toContain('0 games')
    expect(state.ratings.existing).toBe(500)
  })

  it('percent-encoding is delegated to bggClient — store passes raw username (T-02-01)', async () => {
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', name: 'Game', yearPublished: 2020, thumbnail: '', userRating: null },
    ])

    const store = createAppStore(createMockStorage())
    await store.getState().fetchCollection('user with spaces')

    expect(vi.mocked(mockBggFetch)).toHaveBeenCalledWith('user with spaces', undefined)
  })
})

describe('selectRandomPair (RANK-02)', () => {
  it('returns null when fewer than 2 games exist (RANK-02)', () => {
    expect(selectRandomPair({}, [])).toBeNull()
    expect(selectRandomPair({ g0: 500 }, [])).toBeNull()
  })

  it('returns 2 distinct ids from ratings keys (RANK-02)', () => {
    const ratings = { g0: 500, g1: 600, g2: 700 }
    for (let i = 0; i < 20; i++) {
      const pair = selectRandomPair(ratings, [])
      expect(pair).not.toBeNull()
      expect(Object.keys(ratings)).toContain(pair![0])
      expect(Object.keys(ratings)).toContain(pair![1])
      expect(pair![0]).not.toBe(pair![1])
    }
  })

  it('returns the front of skipQueue when queue is non-empty (RANK-04)', () => {
    const ratings = { g0: 500, g1: 600 }
    const skipQueue: Array<[string, string]> = [['g0', 'g1']]
    const pair = selectRandomPair(ratings, skipQueue)
    expect(pair).toEqual(['g0', 'g1'])
  })

  it('excludes top 20 games by rank from eligible pool', () => {
    // 25 games ranked g0 (best) → g24 (worst); only g20–g24 (rank 21-25) are eligible
    const ratings: Record<string, number> = {}
    for (let i = 0; i < 25; i++) ratings[`g${i}`] = 700 - i * 10
    for (let k = 0; k < 50; k++) {
      const pair = selectRandomPair(ratings, [])!
      const sorted = Object.entries(ratings).sort((a, b) => b[1] - a[1])
      const rankA = sorted.findIndex(([id]) => id === pair[0])
      const rankB = sorted.findIndex(([id]) => id === pair[1])
      expect(rankA).toBeGreaterThanOrEqual(20)
      expect(rankB).toBeGreaterThanOrEqual(20)
    }
  })

  it('falls back to full set when fewer than 2 eligible games exist (collection ≤ 21)', () => {
    // Only 3 games total — all top-20, so eligible is empty; must still return a pair
    const ratings = { g0: 700, g1: 600, g2: 500 }
    const pair = selectRandomPair(ratings, [])
    expect(pair).not.toBeNull()
    expect(pair![0]).not.toBe(pair![1])
  })

  it('never pairs two tier-1-rated games together', () => {
    // 25 games where the bottom two (rank 23 and 24) both have rating 100 (tier 1)
    const ratings: Record<string, number> = {}
    for (let i = 0; i < 23; i++) ratings[`g${i}`] = 700 - i * 20
    ratings['g23'] = 100
    ratings['g24'] = 100
    for (let k = 0; k < 50; k++) {
      const pair = selectRandomPair(ratings, [])!
      expect(pair[0] === 'g23' && pair[1] === 'g24').toBe(false)
      expect(pair[0] === 'g24' && pair[1] === 'g23').toBe(false)
    }
  })

  it('only pairs games within 50 rank positions', () => {
    // 80 games ranked g0-g79; eligible starts at rank 20 (g20-g79)
    const ratings: Record<string, number> = {}
    for (let i = 0; i < 80; i++) ratings[`g${i}`] = 800 - i * 5
    for (let k = 0; k < 50; k++) {
      const pair = selectRandomPair(ratings, [])!
      const sorted = Object.entries(ratings).sort((a, b) => b[1] - a[1])
      const rankA = sorted.findIndex(([id]) => id === pair[0])
      const rankB = sorted.findIndex(([id]) => id === pair[1])
      expect(Math.abs(rankA - rankB)).toBeLessThanOrEqual(50)
    }
  })

  it('pairs within ±1 tier when a valid partner exists', () => {
    // 30 games: top 20 excluded, eligible g20-g29 all in tiers 4-7 and within 50 ranks of each other
    const ratings: Record<string, number> = {}
    for (let i = 0; i < 20; i++) ratings[`g${i}`] = 900 - i * 5  // top 20 excluded
    for (let i = 20; i < 30; i++) ratings[`g${i}`] = 700 - (i - 20) * 40  // tiers 4-7
    for (let k = 0; k < 30; k++) {
      const pair = selectRandomPair(ratings, [])!
      const tierA = Math.ceil(ratings[pair[0]] / 100)
      const tierB = Math.ceil(ratings[pair[1]] / 100)
      expect(Math.abs(tierA - tierB)).toBeLessThanOrEqual(1)
    }
  })
})

describe('pick action (RANK-03, RANK-05, PERSIST-01)', () => {
  it('calls applyUpset and updates ratings when winner was ranked lower (RANK-03)', () => {
    const store = setupStoreWithGames(makeGames(2), { g0: 900, g1: 500 })
    store.setState({ currentPair: ['g1', 'g0'] })

    store.getState().pick('g1', 'g0')

    const state = store.getState()
    expect(state.ratings.g1).toBe(900)
    expect(state.ratings.g0).toBe(500)
  })

  it('increments both sessionComparisons and comparisonsTotal by 1 (RANK-05)', () => {
    const store = setupStoreWithGames(makeGames(4), makeRatings(4))
    store.setState({
      sessionComparisons: 4,
      comparisonsTotal: 100,
      currentPair: ['g0', 'g1'],
    })

    store.getState().pick('g0', 'g1')
    expect(store.getState().sessionComparisons).toBe(5)
    expect(store.getState().comparisonsTotal).toBe(101)

    const nextPair = store.getState().currentPair
    if (nextPair) {
      store.setState({ currentPair: nextPair })
      store.getState().pick(nextPair[0], nextPair[1])
    } else {
      store.setState({ currentPair: ['g2', 'g3'] })
      store.getState().pick('g2', 'g3')
    }
    expect(store.getState().sessionComparisons).toBe(6)
    expect(store.getState().comparisonsTotal).toBe(102)
  })

  it('selects next pair from skipQueue front when queue is non-empty (RANK-04)', () => {
    const store = setupStoreWithGames(makeGames(4), makeRatings(4))
    store.setState({
      currentPair: ['g0', 'g1'],
      skipQueue: [['g2', 'g3']],
    })

    store.getState().pick('g0', 'g1')

    expect(store.getState().currentPair).toEqual(['g2', 'g3'])
    expect(store.getState().skipQueue.length).toBe(0)
  })

  it('selects next pair from random pool when skipQueue is empty (RANK-02)', () => {
    const store = setupStoreWithGames(
      makeGames(3),
      { g0: 900, g1: 600, g2: 300 }
    )
    store.setState({ currentPair: ['g0', 'g1'], skipQueue: [] })

    store.getState().pick('g0', 'g1')

    const pair = store.getState().currentPair
    expect(pair).not.toBeNull()
    expect(Object.keys(store.getState().ratings)).toContain(pair![0])
    expect(Object.keys(store.getState().ratings)).toContain(pair![1])
  })

  it('persists ratings to mock localStorage after pick (PERSIST-01)', () => {
    const storage = createMockStorage()
    const store = createAppStore(storage)
    store.setState({
      games: makeGames(2),
      ratings: { g0: 900, g1: 500 },
      currentPair: ['g1', 'g0'],
      rankingsUsername: 'alice',
    })

    store.getState().pick('g1', 'g0')

    const dump = storage._dump()
    const persistKey = 'bgg-ranker:v1:collection-and-rankings'
    expect(persistKey in dump).toBe(true)

    const parsed = JSON.parse(dump[persistKey]) as { state: Record<string, unknown> }
    const persistedState = parsed.state

    const persistedRatings = persistedState.ratings as Record<string, number>
    expect(persistedRatings.g1).toBe(900)

    expect('sessionUsername' in persistedState).toBe(false)
    expect('view' in persistedState).toBe(false)
    expect('currentPair' in persistedState).toBe(false)
    expect('skipQueue' in persistedState).toBe(false)
    expect('sessionComparisons' in persistedState).toBe(false)
  })
})

describe('skip action (RANK-04)', () => {
  it('appends current pair to skipQueue (RANK-04)', () => {
    const store = setupStoreWithGames(makeGames(4), makeRatings(4))
    store.setState({ currentPair: ['g0', 'g1'], skipQueue: [] })

    store.getState().skip()

    expect(store.getState().skipQueue).toEqual([['g0', 'g1']])
  })

  it('sets currentPair to a new random pair after skip (RANK-04)', () => {
    const store = setupStoreWithGames(
      makeGames(4),
      { g0: 900, g1: 600, g2: 300, g3: 100 }
    )
    store.setState({ currentPair: ['g0', 'g1'], skipQueue: [] })

    store.getState().skip()

    const nextPair = store.getState().currentPair
    expect(nextPair).not.toBeNull()
    expect(nextPair![0]).not.toBe(nextPair![1])
  })

  it('does NOT increment session or total comparison counters (RANK-04, RANK-05)', () => {
    const store = setupStoreWithGames(makeGames(4), makeRatings(4))
    store.setState({ sessionComparisons: 5, comparisonsTotal: 100, currentPair: ['g0', 'g1'] })

    store.getState().skip()

    expect(store.getState().sessionComparisons).toBe(5)
    expect(store.getState().comparisonsTotal).toBe(100)
  })

  it('does nothing when currentPair is null (RANK-04)', () => {
    const store = setupStoreWithGames(makeGames(2), makeRatings(2))
    store.setState({ currentPair: null, skipQueue: [] })

    store.getState().skip()

    expect(store.getState().skipQueue).toEqual([])
  })
})

describe('refresh action (REFRESH-01)', () => {
  it('calls fetchCollection with current sessionUsername (REFRESH-01)', () => {
    const store = setupStoreWithGames(makeGames(3), makeRatings(3))
    store.setState({ sessionUsername: 'alice' } as Parameters<typeof store.setState>[0])
    vi.mocked(mockBggFetch).mockResolvedValueOnce([])

    store.getState().refresh()

    expect(vi.mocked(mockBggFetch).mock.calls[0][0]).toBe('alice')
  })

  it('falls back to rankingsUsername when sessionUsername is null (REFRESH-01)', () => {
    const store = setupStoreWithGames(makeGames(3), makeRatings(3), 'bob')
    vi.mocked(mockBggFetch).mockResolvedValueOnce([])

    store.getState().refresh()

    expect(vi.mocked(mockBggFetch).mock.calls[0][0]).toBe('bob')
  })

  it('does nothing when no username is available (REFRESH-01)', () => {
    const store = createAppStore(createMockStorage())

    store.getState().refresh()

    expect(vi.mocked(mockBggFetch)).not.toHaveBeenCalled()
  })
})

describe('partialize / persist guard (PERSIST-01, AUTH-03)', () => {
  it('persists ratings, games, comparisonsTotal, rankingsUsername, lastFetched, version (PERSIST-01)', () => {
    const storage = createMockStorage()
    const store = createAppStore(storage)
    store.setState({
      games: makeGames(2),
      ratings: { g0: 900, g1: 500 },
      currentPair: ['g0', 'g1'],
      rankingsUsername: 'alice',
    })

    store.getState().pick('g0', 'g1')

    const dump = storage._dump()
    const persistKey = 'bgg-ranker:v1:collection-and-rankings'
    const parsed = JSON.parse(dump[persistKey]) as { state: Record<string, unknown> }
    const persistedState = parsed.state

    expect('games' in persistedState).toBe(true)
    expect('lastFetched' in persistedState).toBe(true)
    expect('ratings' in persistedState).toBe(true)
    expect('comparisonsTotal' in persistedState).toBe(true)
    expect('rankingsUsername' in persistedState).toBe(true)
    expect('version' in persistedState).toBe(true)
  })

  it('does NOT persist sessionUsername, view, currentPair, skipQueue, loadingMessage, errorMessage, sessionComparisons (AUTH-03)', () => {
    const storage = createMockStorage()
    const store = createAppStore(storage)
    store.setState({
      games: makeGames(2),
      ratings: { g0: 900, g1: 500 },
      currentPair: ['g0', 'g1'],
      rankingsUsername: 'alice',
      sessionUsername: 'alice',
      view: 'comparison',
      skipQueue: [],
      loadingMessage: null,
      errorMessage: null,
      sessionComparisons: 3,
    })

    store.getState().pick('g0', 'g1')

    const dump = storage._dump()
    const persistKey = 'bgg-ranker:v1:collection-and-rankings'
    const parsed = JSON.parse(dump[persistKey]) as { state: Record<string, unknown> }
    const persistedState = parsed.state

    expect('sessionUsername' in persistedState).toBe(false)
    expect('view' in persistedState).toBe(false)
    expect('currentPair' in persistedState).toBe(false)
    expect('skipQueue' in persistedState).toBe(false)
    expect('loadingMessage' in persistedState).toBe(false)
    expect('errorMessage' in persistedState).toBe(false)
    expect('sessionComparisons' in persistedState).toBe(false)
  })
})

describe('login action (AUTH-01)', () => {
  it('login() sets sessionId in store state (AUTH-01)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'test-session-123' })
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', name: 'Game', yearPublished: 2020, thumbnail: '', userRating: null },
    ])

    const store = createAppStore(createMockStorage())
    await store.getState().login('alice', 'password')

    expect((store.getState() as Record<string, unknown>).sessionId).toBe('test-session-123')
  })

  it('sessionId is absent from the partialize output written to storage (AUTH-03)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'test-session-123' })
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', name: 'Game', yearPublished: 2020, thumbnail: '', userRating: null },
    ])

    const storage = createMockStorage()
    const store = createAppStore(storage)
    await store.getState().login('alice', 'password')

    const dump = storage._dump()
    const persistKey = 'bgg-ranker:v1:collection-and-rankings'
    const parsed = JSON.parse(dump[persistKey] ?? '{"state":{}}') as { state: Record<string, unknown> }
    expect('sessionId' in parsed.state).toBe(false)
  })

  it('login() sets view to "loading" during execution (AUTH-01)', async () => {
    let capturedView: string | undefined
    vi.mocked(mockBggLogin).mockImplementationOnce(async () => {
      capturedView = (store.getState() as Record<string, unknown>).view as string
      return { sessionId: 'session-abc' }
    })
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', name: 'Game', yearPublished: 2020, thumbnail: '', userRating: null },
    ])

    const store = createAppStore(createMockStorage())
    await store.getState().login('alice', 'password')

    expect(capturedView).toBe('loading')
  })
})

describe('startSync action (SYNC-01, SYNC-02)', () => {
  it('startSync() calls bggRateGame for each gameId in dirtyGameIds (SYNC-01)', async () => {
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      ratings: { g0: 900, g1: 901, g2: 902 },
      sessionId: 'active-session',
      dirtyGameIds: ['g0', 'g1', 'g2'],
      games: {
        g0: { id: 'g0', collId: 'coll-g0', name: 'G0', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', collId: 'coll-g1', name: 'G1', yearPublished: 2020, thumbnail: '' },
        g2: { id: 'g2', collId: 'coll-g2', name: 'G2', yearPublished: 2020, thumbnail: '' },
      },
    } as Parameters<typeof store.setState>[0])

    await store.getState().startSync()

    expect(vi.mocked(mockBggRateGame)).toHaveBeenCalledTimes(3)
  })

  it('startSync() only syncs dirty games — games absent from dirtyGameIds are skipped (SYNC-03 resume anchor)', async () => {
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      ratings: { g0: 900, g1: 901, g2: 902 },
      sessionId: 'active-session',
      dirtyGameIds: ['g1', 'g2'],
      games: {
        g0: { id: 'g0', collId: 'coll-g0', name: 'G0', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', collId: 'coll-g1', name: 'G1', yearPublished: 2020, thumbnail: '' },
        g2: { id: 'g2', collId: 'coll-g2', name: 'G2', yearPublished: 2020, thumbnail: '' },
      },
    } as Parameters<typeof store.setState>[0])

    await store.getState().startSync()

    expect(vi.mocked(mockBggRateGame)).toHaveBeenCalledTimes(2)
    const calledCollIds = vi.mocked(mockBggRateGame).mock.calls.map(c => c[0])
    expect(calledCollIds).not.toContain('coll-g0')
  })

  it('startSync() increments syncProgress after each successful write (SYNC-02)', async () => {
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      ratings: { g0: 900, g1: 901 },
      sessionId: 'active-session',
      dirtyGameIds: ['g0', 'g1'],
      games: {
        g0: { id: 'g0', collId: 'coll-g0', name: 'G0', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', collId: 'coll-g1', name: 'G1', yearPublished: 2020, thumbnail: '' },
      },
    } as Parameters<typeof store.setState>[0])

    await store.getState().startSync()

    expect((store.getState() as Record<string, unknown>).syncProgress).toBe(2)
  })

  it('startSync() sets syncStatus to "session-expired" when bggRateGame throws with status 401 (AUTH-03)', async () => {
    vi.mocked(mockBggRateGame).mockRejectedValueOnce(
      Object.assign(new Error('401'), { status: 401 })
    )

    const store = createAppStore(createMockStorage())
    store.setState({
      ratings: { g0: 900 },
      sessionId: 'active-session',
      dirtyGameIds: ['g0'],
      games: {
        g0: { id: 'g0', collId: 'coll-g0', name: 'G0', yearPublished: 2020, thumbnail: '' },
      },
    } as Parameters<typeof store.setState>[0])

    await store.getState().startSync()

    expect((store.getState() as Record<string, unknown>).syncStatus).toBe('session-expired')
  })
})

describe('startSync throttle (SYNC-02)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('startSync() applies 500ms delay between writes — second write fires only after 500ms (SYNC-02)', async () => {
    vi.useFakeTimers()
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      ratings: { g0: 900, g1: 901 },
      sessionId: 'active-session',
      dirtyGameIds: ['g0', 'g1'],
      games: {
        g0: { id: 'g0', collId: 'coll-g0', name: 'G0', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', collId: 'coll-g1', name: 'G1', yearPublished: 2020, thumbnail: '' },
      },
    } as Parameters<typeof store.setState>[0])

    const syncPromise = store.getState().startSync()

    // First write (g0) fires immediately; delay(500) blocks second write
    await vi.advanceTimersByTimeAsync(499)
    expect(vi.mocked(mockBggRateGame)).toHaveBeenCalledTimes(1)

    // Cross the 500ms threshold — second write fires
    await vi.advanceTimersByTimeAsync(1)
    expect(vi.mocked(mockBggRateGame)).toHaveBeenCalledTimes(2)

    // Drain completeSyncAll's 2000ms auto-return timer
    await vi.advanceTimersByTimeAsync(2000)
    await syncPromise
  })
})

describe('markGameSynced action (SYNC-03)', () => {
  it('markGameSynced("g123") removes "g123" from dirtyGameIds (SYNC-03)', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ dirtyGameIds: ['g0', 'g123'] } as Parameters<typeof store.setState>[0])

    store.getState().markGameSynced('g123')

    expect(store.getState().dirtyGameIds).not.toContain('g123')
    expect(store.getState().dirtyGameIds).toContain('g0')
  })

  it('markGameSynced() increments syncProgress (SYNC-03)', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ syncProgress: 3, dirtyGameIds: ['g0'] } as Parameters<typeof store.setState>[0])

    store.getState().markGameSynced('g0')

    expect(store.getState().syncProgress).toBe(4)
  })
})

describe('completeSyncAll action (SYNC-03)', () => {
  it('completeSyncAll() leaves dirtyGameIds empty (SYNC-03)', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ dirtyGameIds: [] } as Parameters<typeof store.setState>[0])

    store.getState().completeSyncAll()

    expect(store.getState().dirtyGameIds).toEqual([])
  })

  it('completeSyncAll() sets comparisonsAtLastSync = comparisonsTotal (SYNC-03)', () => {
    const store = createAppStore(createMockStorage())
    store.setState({
      comparisonsTotal: 42,
      comparisonsAtLastSync: 0,
    } as Parameters<typeof store.setState>[0])

    store.getState().completeSyncAll()

    expect(store.getState().comparisonsAtLastSync).toBe(42)
  })

  it('completeSyncAll() resets sessionComparisons to 0', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ sessionComparisons: 7, dirtyGameIds: [] } as Parameters<typeof store.setState>[0])

    store.getState().completeSyncAll()

    expect(store.getState().sessionComparisons).toBe(0)
  })

  it('completeSyncAll() saves current ratings as lastSyncedRatings', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ ratings: { g0: 900, g1: 800 }, dirtyGameIds: [] } as Parameters<typeof store.setState>[0])

    store.getState().completeSyncAll()

    expect(store.getState().lastSyncedRatings).toEqual({ g0: 900, g1: 800 })
  })
})

describe('reAuthAndResume action (AUTH-03)', () => {
  it('reAuthAndResume() calls bggLogin and updates sessionId (AUTH-03)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'new-session-456' })
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      sessionUsername: 'alice',
      sessionId: 'old-session',
      ratings: { g0: 900 },
      dirtyGameIds: ['g0'],
      games: {
        g0: { id: 'g0', collId: 'coll-g0', name: 'G0', yearPublished: 2020, thumbnail: '' },
      },
    } as Parameters<typeof store.setState>[0])

    await store.getState().reAuthAndResume('newpassword')

    expect(vi.mocked(mockBggLogin)).toHaveBeenCalledWith('alice', 'newpassword')
    expect(store.getState().sessionId).toBe('new-session-456')
  })

  it('reAuthAndResume() resumes sync — only dirty games are written (SYNC-03)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'new-session-456' })
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      sessionUsername: 'alice',
      sessionId: 'old-session',
      ratings: { g0: 700, g1: 900 },
      dirtyGameIds: ['g1'],
      games: {
        g0: { id: 'g0', collId: 'coll-g0', name: 'G0', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', collId: 'coll-g1', name: 'G1', yearPublished: 2020, thumbnail: '' },
      },
    } as Parameters<typeof store.setState>[0])

    await store.getState().reAuthAndResume('newpassword')

    const calledCollIds = vi.mocked(mockBggRateGame).mock.calls.map(c => c[0])
    expect(calledCollIds).not.toContain('coll-g0')
    expect(calledCollIds).toContain('coll-g1')
  })
})

describe('cancelSync action', () => {
  it('cancelSync() sets sessionId to null (loop check aborts)', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ sessionId: 'active-session' } as Parameters<typeof store.setState>[0])

    store.getState().cancelSync()

    expect(store.getState().sessionId).toBeNull()
  })

  it('cancelSync() does NOT clear dirtyGameIds — remaining dirty games preserved for resume', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ sessionId: 'active-session', dirtyGameIds: ['g0', 'g1'] } as Parameters<typeof store.setState>[0])

    store.getState().cancelSync()

    expect(store.getState().dirtyGameIds).toEqual(['g0', 'g1'])
  })
})

describe('beforeunload predicate (AUTH-02)', () => {
  it('dirtyGameIds.length > 0 after a pick that changes ratings (AUTH-02)', () => {
    const store = setupStoreWithGames(makeGames(2), { g0: 900, g1: 500 })
    store.setState({
      comparisonsTotal: 0,
      dirtyGameIds: [],
      currentPair: ['g0', 'g1'],
    } as Parameters<typeof store.setState>[0])

    store.getState().pick('g1', 'g0')

    expect(store.getState().dirtyGameIds.length).toBeGreaterThan(0)
  })

  it('dirtyGameIds is empty after all games are marked synced (AUTH-02)', () => {
    const store = createAppStore(createMockStorage())
    store.setState({
      dirtyGameIds: ['g0', 'g1'],
    } as Parameters<typeof store.setState>[0])

    store.getState().markGameSynced('g0')
    store.getState().markGameSynced('g1')

    expect(store.getState().dirtyGameIds).toEqual([])
  })
})

describe('RankingsStateSlice persistence (SYNC-03)', () => {
  it('dirtyGameIds and comparisonsAtLastSync are present in partialize output (SYNC-03)', () => {
    const storage = createMockStorage()
    const store = createAppStore(storage)
    store.setState({
      games: makeGames(2),
      ratings: { g0: 900, g1: 500 },
      currentPair: ['g0', 'g1'],
      dirtyGameIds: ['g0'],
      comparisonsAtLastSync: 5,
    } as Parameters<typeof store.setState>[0])

    store.getState().pick('g0', 'g1')

    const dump = storage._dump()
    const persistKey = 'bgg-ranker:v1:collection-and-rankings'
    const parsed = JSON.parse(dump[persistKey]) as { state: Record<string, unknown> }
    expect('dirtyGameIds' in parsed.state).toBe(true)
    expect('comparisonsAtLastSync' in parsed.state).toBe(true)
  })

  it('sessionId is absent from partialize output (AUTH-03)', () => {
    const storage = createMockStorage()
    const store = createAppStore(storage)
    store.setState({
      games: makeGames(2),
      ratings: { g0: 900, g1: 500 },
      currentPair: ['g0', 'g1'],
      sessionId: 'should-not-persist',
    } as Parameters<typeof store.setState>[0])

    store.getState().pick('g0', 'g1')

    const dump = storage._dump()
    const persistKey = 'bgg-ranker:v1:collection-and-rankings'
    const parsed = JSON.parse(dump[persistKey]) as { state: Record<string, unknown> }
    expect('sessionId' in parsed.state).toBe(false)
  })
})

describe('pick() upset detection (D-01, D-02, D-03)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets lastUpset when winner was ranked lower than loser (upset) (D-01)', () => {
    const store = setupStoreWithGames(makeGames(4), { g3: 900, g2: 700, g1: 500, g0: 300 })
    store.setState({ currentPair: ['g0', 'g3'] } as Parameters<typeof store.setState>[0])

    store.getState().pick('g0', 'g3')

    const state = store.getState() as Record<string, unknown>
    expect(state.lastUpset).not.toBeNull()
    const lastUpset = state.lastUpset as { winnerName: string; spotsGained: number }
    expect(lastUpset.winnerName).toBe('Game 0')
    expect(lastUpset.spotsGained).toBe(3)
  })

  it('does NOT set lastUpset when winner was ranked higher than loser (normal result) (D-01)', () => {
    const store = setupStoreWithGames(makeGames(4), { g3: 900, g2: 700, g1: 500, g0: 300 })
    store.setState({ currentPair: ['g3', 'g0'] } as Parameters<typeof store.setState>[0])

    store.getState().pick('g3', 'g0')

    const state = store.getState() as Record<string, unknown>
    expect(state.lastUpset).toBeNull()
  })

  it('clears lastUpset after 5 seconds (D-03)', () => {
    vi.useFakeTimers()

    const store = setupStoreWithGames(makeGames(4), { g3: 900, g2: 700, g1: 500, g0: 300 })
    store.setState({ currentPair: ['g0', 'g3'] } as Parameters<typeof store.setState>[0])

    store.getState().pick('g0', 'g3')

    const stateBefore = store.getState() as Record<string, unknown>
    expect(stateBefore.lastUpset).not.toBeNull()

    vi.advanceTimersByTime(5000)

    const stateAfter = store.getState() as Record<string, unknown>
    expect(stateAfter.lastUpset).toBeNull()
  })
})

describe('markUnplayed() dirty tracking (SYNC-03)', () => {
  it('adds the game ID to dirtyGameIds when marked unplayed', () => {
    const store = setupStoreWithGames(makeGames(3), makeRatings(3))
    store.setState({ dirtyGameIds: [] })
    store.getState().markUnplayed('g1')
    expect(store.getState().dirtyGameIds).toContain('g1')
  })

  it('does not duplicate an ID already in dirtyGameIds', () => {
    const store = setupStoreWithGames(makeGames(3), makeRatings(3))
    store.setState({ dirtyGameIds: ['g1'] })
    store.getState().markUnplayed('g1')
    expect(store.getState().dirtyGameIds.filter(id => id === 'g1').length).toBe(1)
  })
})

describe('reorderRankedList() dirty tracking (SYNC-03)', () => {
  it('marks IDs whose ratings changed after reorder as dirty', () => {
    const games = makeGames(3)
    const ratings = makeRatings(3)
    const store = setupStoreWithGames(games, ratings)
    store.setState({ dirtyGameIds: [] })
    const original = Object.keys(ratings).sort((a, b) => ratings[b] - ratings[a])
    const reversed = [...original].reverse()
    store.getState().reorderRankedList(reversed)
    const dirty = store.getState().dirtyGameIds
    expect(dirty.length).toBeGreaterThan(0)
    for (const id of dirty) {
      expect(store.getState().ratings[id]).not.toBe(ratings[id])
    }
  })

  it('does not mark IDs whose ratings did not change', () => {
    const games = makeGames(3)
    const ratings = makeRatings(3)
    const store = setupStoreWithGames(games, ratings)
    const sameOrder = Object.keys(ratings).sort((a, b) => ratings[b] - ratings[a])
    // First call establishes initializeRankings-derived ratings for this order
    store.getState().reorderRankedList(sameOrder)
    store.setState({ dirtyGameIds: [] })
    // Second call with identical order — initializeRankings is deterministic, so no ratings change
    store.getState().reorderRankedList(sameOrder)
    expect(store.getState().dirtyGameIds.length).toBe(0)
  })
})

describe('moveUnplayedToRanked() dirty tracking (SYNC-03)', () => {
  it('adds IDs whose ratings changed after insertion to dirtyGameIds', () => {
    const games = makeGames(3)
    const ratings = makeRatings(3)
    const store = setupStoreWithGames(games, ratings)
    store.setState({ unplayedIds: ['g2'], dirtyGameIds: [] })
    const { ratings: r } = store.getState()
    const before = { ...r }
    store.getState().moveUnplayedToRanked('g2', 1)
    const dirty = store.getState().dirtyGameIds
    expect(dirty.length).toBeGreaterThan(0)
    for (const id of dirty) {
      expect(store.getState().ratings[id]).not.toBe(before[id])
    }
  })

  it('moves game from unplayedIds to ratings and marks it dirty', () => {
    const games = makeGames(2)
    const ratings = makeRatings(2)
    const store = setupStoreWithGames(games, ratings)
    store.setState({ unplayedIds: ['g0'], dirtyGameIds: [] })
    store.setState({ ratings: { g1: 500 } })
    store.getState().moveUnplayedToRanked('g0', 1)
    expect(store.getState().unplayedIds).not.toContain('g0')
    expect('g0' in store.getState().ratings).toBe(true)
    expect(store.getState().dirtyGameIds).toContain('g0')
  })
})

// D-14: verified covered by moveUnplayedToRanked() dirty tracking (SYNC-03) describe block above — no additional test needed
describe('showRankedGrid() action (D-02)', () => {
  it('sets view to ranked-grid from comparison', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ view: 'comparison' })
    store.getState().showRankedGrid()
    expect(store.getState().view).toBe('ranked-grid')
  })

  it('backToComparison() returns from ranked-grid to comparison', () => {
    const store = createAppStore(createMockStorage())
    store.setState({ view: 'ranked-grid' })
    store.getState().backToComparison()
    expect(store.getState().view).toBe('comparison')
  })
})

describe('login() auto-resume (D-07)', () => {
  it('skips fetchCollection and calls continueSession when same user has stored data', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'sess123' })

    const store = createAppStore(createMockStorage())
    store.setState({
      rankingsUsername: 'alice',
      ratings: makeRatings(3),
      games: makeGames(3),
    })

    await store.getState().login('alice', 'pw')

    expect(vi.mocked(mockBggFetch)).not.toHaveBeenCalled()
    expect(store.getState().view).toBe('comparison')
  })

  it('preserves existing ratings on auto-resume (comparisonsTotal not reset)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'sess123' })

    const store = createAppStore(createMockStorage())
    store.setState({
      rankingsUsername: 'alice',
      ratings: makeRatings(3),
      games: makeGames(3),
      comparisonsTotal: 42,
    })

    await store.getState().login('alice', 'pw')

    expect(store.getState().comparisonsTotal).toBe(42)
    expect(Object.keys(store.getState().ratings).length).toBe(3)
  })

  it('fetches from BGG when stored rankings belong to a different user', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'sess123' })
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', collId: 'c0', name: 'Game 0', yearPublished: 2020, thumbnail: '', userRating: 7 },
    ])

    const store = createAppStore(createMockStorage())
    store.setState({
      rankingsUsername: 'bob',
      ratings: makeRatings(3),
      games: makeGames(3),
    })

    await store.getState().login('alice', 'pw')

    expect(vi.mocked(mockBggFetch)).toHaveBeenCalledWith('alice', 'sess123')
    expect(store.getState().view).toBe('comparison')
  })

  it('places N/A-rated games (userRating null) into unplayedIds, not ratings', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'sess123' })
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'r0', collId: 'c0', name: 'Rated',   yearPublished: 2020, thumbnail: '', userRating: 7 },
      { id: 'u0', collId: 'c1', name: 'Unrated', yearPublished: 2021, thumbnail: '', userRating: null },
    ])

    const store = createAppStore(createMockStorage())
    await store.getState().login('alice', 'pw')

    expect('r0' in store.getState().ratings).toBe(true)
    expect('u0' in store.getState().ratings).toBe(false)
    expect(store.getState().unplayedIds).toContain('u0')
  })
})
