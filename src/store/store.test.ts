/**
 * store.test.ts — Unit tests for the Zustand app store
 *
 * Covers requirements: RANK-01, RANK-02, RANK-03, RANK-04, RANK-05, REFRESH-01, PERSIST-01, PERSIST-02
 * Each test name includes the relevant requirement ID for grep traceability.
 *
 * NOTE: vitest environment is 'node'. localStorage is NOT available in this environment.
 * All persist tests use a custom in-memory mock storage object (see createMockStorage below).
 * This approach avoids changing the global vitest.config.ts environment setting and keeps
 * existing engine tests unaffected (RESEARCH.md Pitfall 6).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../api/bggClient', () => ({
  fetchCollection: vi.fn(),
  bggLogin: vi.fn(),
  bggRateGame: vi.fn(),
}))

import { fetchCollection as mockBggFetch, bggLogin as mockBggLogin, bggRateGame as mockBggRateGame } from '../api/bggClient'
import { createAppStore, selectRandomPair, type Game } from './store'

// ---------------------------------------------------------------------------
// Mock storage factory — in-memory replacement for localStorage
// ---------------------------------------------------------------------------

function createMockStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string): string | null => store[k] ?? null,
    setItem: (k: string, v: string): void => {
      store[k] = v
    },
    removeItem: (k: string): void => {
      delete store[k]
    },
    _dump: (): Record<string, string> => ({ ...store }),
  }
}

// ---------------------------------------------------------------------------
// Helper: create n games keyed by g0..g{n-1}
// ---------------------------------------------------------------------------

function makeGames(n: number): Record<string, Game> {
  const games: Record<string, Game> = {}
  for (let i = 0; i < n; i++) {
    games[`g${i}`] = {
      id: `g${i}`,
      name: `Game ${i}`,
      yearPublished: 2000 + i,
      thumbnail: '',
    }
  }
  return games
}

// ---------------------------------------------------------------------------
// Helper: create integer ratings keyed by g0..g{n-1}
// ---------------------------------------------------------------------------

function makeRatings(n: number): Record<string, number> {
  const ratings: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    // Spread evenly from 1000 down, ensuring unique integer values
    ratings[`g${i}`] = 1000 - i * Math.floor(1000 / (n + 1))
  }
  return ratings
}

// ---------------------------------------------------------------------------
// Setup: reset mock before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(mockBggFetch).mockReset()
  vi.mocked(mockBggLogin).mockReset()
  vi.mocked(mockBggRateGame).mockReset()
})

// ---------------------------------------------------------------------------
// Helper: build a store with pre-seeded state
// ---------------------------------------------------------------------------

function setupStoreWithGames(
  games: Record<string, Game>,
  ratings?: Record<string, number>,
  rankingsUsername: string | null = null
) {
  const store = createAppStore(createMockStorage())
  store.setState({ games, ratings: ratings ?? {}, rankingsUsername })
  return store
}

// ---------------------------------------------------------------------------
// fetchCollection action (RANK-01, COLL-01, PERSIST-02)
// ---------------------------------------------------------------------------

describe('fetchCollection action (RANK-01, COLL-01, PERSIST-02)', () => {
  it('calls initializeRankings and seeds integer ratings on first load for this user (RANK-01)', async () => {
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', name: 'A', yearPublished: 2020, thumbnail: '', userRating: null },
      { id: 'g1', name: 'B', yearPublished: 2021, thumbnail: '', userRating: null },
      { id: 'g2', name: 'C', yearPublished: 2022, thumbnail: '', userRating: null },
      { id: 'g3', name: 'D', yearPublished: 2023, thumbnail: '', userRating: null },
      { id: 'g4', name: 'E', yearPublished: 2024, thumbnail: '', userRating: null },
    ])

    const store = createAppStore(createMockStorage())
    await store.getState().fetchCollection('alice')

    const state = store.getState()
    const ratingValues = Object.values(state.ratings)

    expect(ratingValues.length).toBe(5)
    ratingValues.forEach((v) => {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(1000)
    })
    expect(new Set(ratingValues).size).toBe(5)
    expect(state.rankingsUsername).toBe('alice')
    expect(state.view).toBe('comparison')
    expect(state.currentPair).not.toBeNull()
    expect(state.currentPair![0]).not.toBe(state.currentPair![1])
  })

  it('always proceeds to fetch even when rankingsUsername matches — PERSIST-02 guard moved to login() (D-07)', async () => {
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

    // fetchCollection no longer has PERSIST-02 guard — it always fetches (Pitfall 3)
    // The guard now lives exclusively in login() for D-07 auto-resume
    expect(vi.mocked(mockBggFetch)).toHaveBeenCalledWith('alice', undefined)
    expect(store.getState().view).toBe('comparison')
  })

  it('discards stored rankings and reseeds when entered username differs from rankingsUsername (PERSIST-02)', async () => {
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'new0', name: 'New Game 0', yearPublished: 2020, thumbnail: '', userRating: null },
      { id: 'new1', name: 'New Game 1', yearPublished: 2021, thumbnail: '', userRating: null },
      { id: 'new2', name: 'New Game 2', yearPublished: 2022, thumbnail: '', userRating: null },
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
      name: `Game ${i}`,
      yearPublished: 2000,
      thumbnail: '',
      userRating: null,
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

// ---------------------------------------------------------------------------
// selectRandomPair (RANK-02)
// ---------------------------------------------------------------------------

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
})

// ---------------------------------------------------------------------------
// pick action (RANK-03, RANK-05, PERSIST-01)
// ---------------------------------------------------------------------------

describe('pick action (RANK-03, RANK-05, PERSIST-01)', () => {
  it('calls applyUpset and updates ratings when winner was ranked lower (RANK-03)', () => {
    const store = setupStoreWithGames(makeGames(2), { g0: 900, g1: 500 })
    store.setState({ currentPair: ['g1', 'g0'] })

    store.getState().pick('g1', 'g0')

    const state = store.getState()
    // g1 was the upset winner (previously 500, g0 was 900)
    // After upset: g1 takes g0's slot (900), g0 shifts down to g1's old slot (500)
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
      // Force a valid pair for the second pick
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

    // After upset: g1 (winner) takes g0's position (900)
    const persistedRatings = persistedState.ratings as Record<string, number>
    expect(persistedRatings.g1).toBe(900)

    // Partialize exclusions: session-only fields must NOT be in persisted state
    expect('sessionUsername' in persistedState).toBe(false)
    expect('view' in persistedState).toBe(false)
    expect('currentPair' in persistedState).toBe(false)
    expect('skipQueue' in persistedState).toBe(false)
    expect('sessionComparisons' in persistedState).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// skip action (RANK-04)
// ---------------------------------------------------------------------------

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
    // The skipped pair should not immediately re-present (queue only drains on pick)
    // Note: with purely random selection there's a small chance it picks the same pair;
    // that's acceptable — the key invariant is that the pair comes from the random pool.
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

// ---------------------------------------------------------------------------
// refresh action (REFRESH-01)
// ---------------------------------------------------------------------------

describe('refresh action (REFRESH-01)', () => {
  it('calls redistribute and updates ratings (REFRESH-01)', () => {
    const store = setupStoreWithGames(
      makeGames(3),
      { g0: 100, g1: 500, g2: 1000 }
    )
    const beforeRatings = { ...store.getState().ratings }

    store.getState().refresh()

    const afterRatings = store.getState().ratings
    // Object identity must differ (new object returned)
    expect(afterRatings).not.toBe(beforeRatings)
    // All values must still be integers in [1, 1000]
    Object.values(afterRatings).forEach((v) => {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(1000)
    })
    // All values must be unique
    const vals = Object.values(afterRatings)
    expect(new Set(vals).size).toBe(vals.length)
  })

  it('preserves relative order (REFRESH-01)', () => {
    const store = setupStoreWithGames(
      makeGames(3),
      { g0: 100, g1: 500, g2: 1000 }
    )

    store.getState().refresh()

    const afterRatings = store.getState().ratings
    // Sort descending to get order: g2 should be first, then g1, then g0
    const sorted = Object.entries(afterRatings)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
    expect(sorted).toEqual(['g2', 'g1', 'g0'])
  })

  it('does NOT increment comparison counters (REFRESH-01, RANK-05)', () => {
    const store = setupStoreWithGames(makeGames(3), makeRatings(3))
    store.setState({ sessionComparisons: 5, comparisonsTotal: 100 })

    store.getState().refresh()

    expect(store.getState().sessionComparisons).toBe(5)
    expect(store.getState().comparisonsTotal).toBe(100)
  })

  it('selects a fresh currentPair after refresh (REFRESH-01)', () => {
    const store = setupStoreWithGames(makeGames(5), makeRatings(5))
    store.setState({ currentPair: null })

    store.getState().refresh()

    expect(store.getState().currentPair).not.toBeNull()
    expect(Object.keys(store.getState().ratings)).toContain(store.getState().currentPair![0])
    expect(Object.keys(store.getState().ratings)).toContain(store.getState().currentPair![1])
  })
})

// ---------------------------------------------------------------------------
// partialize / persist guard (PERSIST-01, AUTH-03)
// ---------------------------------------------------------------------------

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

    // Trigger a state change to force persistence
    store.getState().pick('g0', 'g1')

    const dump = storage._dump()
    const persistKey = 'bgg-ranker:v1:collection-and-rankings'
    const parsed = JSON.parse(dump[persistKey]) as { state: Record<string, unknown> }
    const persistedState = parsed.state

    // Exactly these 6 keys must be present
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

    // These 7 ephemeral fields must NOT be in the persisted state (AUTH-03 + CLAUDE.md)
    expect('sessionUsername' in persistedState).toBe(false)
    expect('view' in persistedState).toBe(false)
    expect('currentPair' in persistedState).toBe(false)
    expect('skipQueue' in persistedState).toBe(false)
    expect('loadingMessage' in persistedState).toBe(false)
    expect('errorMessage' in persistedState).toBe(false)
    expect('sessionComparisons' in persistedState).toBe(false)
  })
})

// ===========================================================================
// Phase 3: Auth & BGG Sync — RED tests
// All tests below expect failures until 03-02 through 03-04 implement these features.
// ===========================================================================

// ---------------------------------------------------------------------------
// login action (AUTH-01)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// startSync action (SYNC-01, SYNC-02)
// ---------------------------------------------------------------------------

describe('startSync action (SYNC-01, SYNC-02)', () => {
  it('startSync() calls bggRateGame for each gameId in dirtyGameIds (SYNC-01)', async () => {
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      ratings: { g0: 900, g1: 700, g2: 500 },
      sessionId: 'active-session',
      dirtyGameIds: ['g0', 'g1', 'g2'],
    } as Parameters<typeof store.setState>[0])

    await store.getState().startSync()

    expect(vi.mocked(mockBggRateGame)).toHaveBeenCalledTimes(3)
  })

  it('startSync() only syncs dirty games — games absent from dirtyGameIds are skipped (SYNC-03 resume anchor)', async () => {
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      ratings: { g0: 900, g1: 700, g2: 500 },
      sessionId: 'active-session',
      dirtyGameIds: ['g1', 'g2'], // g0 already clean — not in dirty set
    } as Parameters<typeof store.setState>[0])

    await store.getState().startSync()

    expect(vi.mocked(mockBggRateGame)).toHaveBeenCalledTimes(2)
    const calledWith = vi.mocked(mockBggRateGame).mock.calls.map(c => c[0])
    expect(calledWith).not.toContain('g0')
  })

  it('startSync() increments syncProgress after each successful write (SYNC-02)', async () => {
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      ratings: { g0: 900, g1: 700 },
      sessionId: 'active-session',
      dirtyGameIds: ['g0', 'g1'],
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
    } as Parameters<typeof store.setState>[0])

    await store.getState().startSync()

    expect((store.getState() as Record<string, unknown>).syncStatus).toBe('session-expired')
  })
})

// ---------------------------------------------------------------------------
// markGameSynced action (SYNC-03)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// completeSyncAll action (SYNC-03)
// ---------------------------------------------------------------------------

describe('completeSyncAll action (SYNC-03)', () => {
  it('completeSyncAll() leaves dirtyGameIds empty (all removed by markGameSynced during sync) (SYNC-03)', () => {
    const store = createAppStore(createMockStorage())
    // Simulate post-sync state: markGameSynced() already removed each ID
    store.setState({ dirtyGameIds: [] } as Parameters<typeof store.setState>[0])

    store.getState().completeSyncAll()

    expect(store.getState().dirtyGameIds).toEqual([])
  })

  it('completeSyncAll() sets comparisonsAtLastSync = comparisonsTotal (SYNC-03, D-12)', () => {
    const store = createAppStore(createMockStorage())
    store.setState({
      comparisonsTotal: 42,
      comparisonsAtLastSync: 0,
    } as Parameters<typeof store.setState>[0])

    store.getState().completeSyncAll()

    expect(store.getState().comparisonsAtLastSync).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// reAuthAndResume action (AUTH-03)
// ---------------------------------------------------------------------------

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
    } as Parameters<typeof store.setState>[0])

    await store.getState().reAuthAndResume('newpassword')

    expect(vi.mocked(mockBggLogin)).toHaveBeenCalledWith('alice', 'newpassword')
    expect(store.getState().sessionId).toBe('new-session-456')
  })

  it('reAuthAndResume() resumes sync — only dirty games are written (g0 already clean) (SYNC-03, D-10)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'new-session-456' })
    vi.mocked(mockBggRateGame).mockResolvedValue(undefined)

    const store = createAppStore(createMockStorage())
    store.setState({
      sessionUsername: 'alice',
      sessionId: 'old-session',
      ratings: { g0: 900, g1: 700 },
      dirtyGameIds: ['g1'], // g0 already clean; only g1 should be called
    } as Parameters<typeof store.setState>[0])

    await store.getState().reAuthAndResume('newpassword')

    const calledWith = vi.mocked(mockBggRateGame).mock.calls.map(c => c[0])
    expect(calledWith).not.toContain('g0')
    expect(calledWith).toContain('g1')
  })
})

// ---------------------------------------------------------------------------
// cancelSync action
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// beforeunload predicate (AUTH-02)
// ---------------------------------------------------------------------------

describe('beforeunload predicate (AUTH-02)', () => {
  it('dirtyGameIds.length > 0 after a pick that changes ratings (AUTH-02)', () => {
    const store = setupStoreWithGames(makeGames(2), { g0: 900, g1: 500 })
    store.setState({
      comparisonsTotal: 0,
      dirtyGameIds: [],
      currentPair: ['g0', 'g1'],
    } as Parameters<typeof store.setState>[0])

    store.getState().pick('g1', 'g0')  // upset: g1 (500) beats g0 (900) → ratings change

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

// ---------------------------------------------------------------------------
// RankingsStateSlice persistence (SYNC-03)
// ---------------------------------------------------------------------------

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

  it('sessionId is absent from partialize output (belt-and-suspenders, AUTH-03)', () => {
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

// ===========================================================================
// Phase 4: Display Polish — RED tests
// All tests below expect failures until 04-02 through 04-04 implement these features.
// ===========================================================================

// ---------------------------------------------------------------------------
// pick() upset detection (D-01, D-02, D-03)
// ---------------------------------------------------------------------------

describe('pick() upset detection (D-01, D-02, D-03)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets lastUpset when winner was ranked lower than loser (upset) (D-01)', () => {
    // g3=900 (rank1/pos0), g2=700 (rank2/pos1), g1=500 (rank3/pos2), g0=300 (rank4/pos3)
    const store = setupStoreWithGames(makeGames(4), { g3: 900, g2: 700, g1: 500, g0: 300 })
    store.setState({ currentPair: ['g0', 'g3'] } as Parameters<typeof store.setState>[0])

    // g0 (pos3) beats g3 (pos0) — upset: winner was ranked lower
    store.getState().pick('g0', 'g3')

    const state = store.getState() as Record<string, unknown>
    expect(state.lastUpset).not.toBeNull()
    const lastUpset = state.lastUpset as { winnerName: string; spotsGained: number }
    expect(lastUpset.winnerName).toBe('Game 0')
    expect(lastUpset.spotsGained).toBe(3)
  })

  it('does NOT set lastUpset when winner was ranked higher than loser (normal result) (D-01)', () => {
    // g3=900 (rank1/pos0), g2=700, g1=500, g0=300 (rank4/pos3)
    const store = setupStoreWithGames(makeGames(4), { g3: 900, g2: 700, g1: 500, g0: 300 })
    store.setState({ currentPair: ['g3', 'g0'] } as Parameters<typeof store.setState>[0])

    // g3 (pos0) beats g0 (pos3) — normal: winner was already ranked higher
    store.getState().pick('g3', 'g0')

    const state = store.getState() as Record<string, unknown>
    expect(state.lastUpset).toBeNull()
  })

  it('clears lastUpset after 5 seconds (D-03)', () => {
    vi.useFakeTimers()

    const store = setupStoreWithGames(makeGames(4), { g3: 900, g2: 700, g1: 500, g0: 300 })
    store.setState({ currentPair: ['g0', 'g3'] } as Parameters<typeof store.setState>[0])

    store.getState().pick('g0', 'g3')

    // Immediately after pick: lastUpset should be non-null
    const stateBefore = store.getState() as Record<string, unknown>
    expect(stateBefore.lastUpset).not.toBeNull()

    // Advance timers by 5000ms
    vi.advanceTimersByTime(5000)

    // After 5 seconds: lastUpset should be cleared
    const stateAfter = store.getState() as Record<string, unknown>
    expect(stateAfter.lastUpset).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// login() auto-resume (D-07)
// ---------------------------------------------------------------------------

describe('login() auto-resume (D-07)', () => {
  it('skips fetchCollection and goes to comparison view when stored rankings belong to same user (D-07)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'sess123' })

    const store = createAppStore(createMockStorage())
    store.setState({
      rankingsUsername: 'alice',
      ratings: makeRatings(3),
      games: makeGames(3),
    })

    await store.getState().login('alice', 'pw')

    // fetchCollection should NOT have been called
    expect(vi.mocked(mockBggFetch)).not.toHaveBeenCalled()

    // Should be in comparison view (auto-resumed)
    expect(store.getState().view).toBe('comparison')
    expect((store.getState() as Record<string, unknown>).sessionId).toBe('sess123')
  })

  it('calls fetchCollection when stored rankings belong to a different user (D-07)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'sess123' })
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', name: 'Game 0', yearPublished: 2020, thumbnail: '', userRating: null },
    ])

    const store = createAppStore(createMockStorage())
    store.setState({
      rankingsUsername: 'bob',
      ratings: makeRatings(3),
      games: makeGames(3),
    })

    await store.getState().login('alice', 'pw')

    expect(vi.mocked(mockBggFetch)).toHaveBeenCalled()
  })

  it('calls fetchCollection when same user but no ratings exist (D-07)', async () => {
    vi.mocked(mockBggLogin).mockResolvedValueOnce({ sessionId: 'sess123' })
    vi.mocked(mockBggFetch).mockResolvedValueOnce([
      { id: 'g0', name: 'Game 0', yearPublished: 2020, thumbnail: '', userRating: null },
    ])

    const store = createAppStore(createMockStorage())
    store.setState({
      rankingsUsername: 'alice',
      ratings: {},
      games: makeGames(3),
    })

    await store.getState().login('alice', 'pw')

    expect(vi.mocked(mockBggFetch)).toHaveBeenCalled()
  })
})
