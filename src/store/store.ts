/**
 * store.ts — Zustand App Store
 *
 * All API calls flow through store actions — UI components never import bggClient directly (CLAUDE.md).
 * sessionUsername (ephemeral, not persisted, AUTH-03 discipline) vs rankingsUsername (persisted, PERSIST-02 guard per D-09).
 * Ratings stored as integers: 801 = 8.01 (divide by 100 only at display/sync time).
 * localStorage key: bgg-ranker:v1:collection-and-rankings
 */

import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import {
  fetchCollection as bggFetchCollection,
  bggLogin,
  bggRateGame,
  type RawGame,
} from '../api/bggClient'
import {
  initializeRankings,
  applyUpset,
  redistribute,
  validateTierCapacity,
  TierCapacityError,
} from '../engine/rankingEngine'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Game {
  id: string
  name: string
  yearPublished: number
  thumbnail: string
}

// ---------------------------------------------------------------------------
// Internal slice interfaces (not exported — minimal public surface)
// ---------------------------------------------------------------------------

interface SessionStateSlice {
  sessionUsername: string | null // ephemeral — NEVER in partialize (AUTH-03, D-08)
  sessionId: string | null       // ephemeral — NEVER in partialize (AUTH-03, D-13)
}

interface CollectionStateSlice {
  games: Record<string, Game>
  lastFetched: number | null
}

interface RankingsStateSlice {
  ratings: Record<string, number> // integer-internal: 801 = 8.01
  comparisonsTotal: number
  rankingsUsername: string | null // PERSIST-02 guard (D-09) — persisted
  version: number
  syncedGameIds: string[]         // persisted — SYNC-03 resume anchor (D-11, D-14)
  comparisonsAtLastSync: number   // persisted — beforeunload predicate (D-12, D-14)
  // Both start at 0: button disabled until first comparison (Pitfall 5)
}

interface ComparisonStateSlice {
  view: 'entry' | 'loading' | 'comparison' | 'error' | 'syncing'
  currentPair: [string, string] | null
  sessionComparisons: number
  skipQueue: Array<[string, string]>
  loadingMessage: string | null
  errorMessage: string | null
  syncStatus: 'idle' | 'syncing' | 'session-expired' | 'error' | 'complete' // Q3
  syncProgress: number  // games written so far in current sync batch
  syncTotal: number     // total games to write in current sync batch
}

interface AppActions {
  setSessionUsername(username: string): void
  fetchCollection(username: string): Promise<void>
  continueSession(): void
  resetForNewUser(): void
  pick(winnerId: string, loserId: string): void
  skip(): void
  refresh(): void
  // Phase 3 actions (D-16)
  login(username: string, password: string): Promise<void>
  startSync(): Promise<void>
  markGameSynced(gameId: string): void
  completeSyncAll(): void
  reAuthAndResume(password: string): Promise<void>
  cancelSync(): void
}

export type AppStore = SessionStateSlice &
  CollectionStateSlice &
  RankingsStateSlice &
  ComparisonStateSlice &
  AppActions

// ---------------------------------------------------------------------------
// selectRandomPair — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * selectRandomPair — Select two distinct game IDs for a comparison.
 *
 * Returns the front of skipQueue if non-empty (drain semantics).
 * Otherwise returns a purely random pair from ratings keys.
 *
 * @param ratings - Current ratings map
 * @param skipQueue - Queue of previously skipped pairs
 * @returns A [winnerId, loserId] pair or null if fewer than 2 games exist
 */
export function selectRandomPair(
  ratings: Record<string, number>,
  skipQueue: Array<[string, string]>
): [string, string] | null {
  if (skipQueue.length > 0) {
    return skipQueue[0]
  }

  const ids = Object.keys(ratings)
  if (ids.length < 2) return null

  const a = Math.floor(Math.random() * ids.length)
  let b = Math.floor(Math.random() * (ids.length - 1))
  if (b >= a) b++

  return [ids[a], ids[b]]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * delay — Simple promise-based timer for throttling between BGG write calls.
 * Defined here to keep the module boundary clean (not imported from bggClient).
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Store factory (injectable storage for testing)
// ---------------------------------------------------------------------------

/**
 * createAppStore — Factory that creates the Zustand store with inject-able storage.
 *
 * Returns a UseBoundStore (callable as a React hook) that also implements StoreApi.
 *
 * @param rawStorage - Raw StateStorage adapter; wrapped with createJSONStorage internally.
 *                     In tests, pass createMockStorage(). In the browser, pass localStorage.
 * @returns Callable Zustand store hook (UseBoundStore<StoreApi<AppStore>>)
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createAppStore(rawStorage: StateStorage) {
  const storage = createJSONStorage(() => rawStorage)
  return create<AppStore>()(
    persist(
      (set, get) => ({
        // --- Initial state ---
        sessionUsername: null,
        sessionId: null,
        games: {},
        lastFetched: null,
        ratings: {},
        comparisonsTotal: 0,
        rankingsUsername: null,
        version: 1,
        syncedGameIds: [],
        comparisonsAtLastSync: 0,
        view: 'entry',
        currentPair: null,
        sessionComparisons: 0,
        skipQueue: [],
        loadingMessage: null,
        errorMessage: null,
        syncStatus: 'idle',
        syncProgress: 0,
        syncTotal: 0,

        // --- Actions ---

        setSessionUsername(username: string) {
          set({ sessionUsername: username })
        },

        async fetchCollection(username: string): Promise<void> {
          const state = get()

          // PERSIST-02 guard (D-09): returning user with matching stored rankings
          if (
            state.rankingsUsername === username &&
            Object.keys(state.ratings).length > 0 &&
            Object.keys(state.games).length > 0
          ) {
            // D-10: show continue-or-refetch prompt by staying on entry view
            set({ sessionUsername: username, view: 'entry' })
            return
          }

          // New user or no stored rankings — proceed to fetch
          set({
            sessionUsername: username,
            view: 'loading',
            loadingMessage: 'Fetching your games from BGG. This may take a moment.',
            errorMessage: null,
          })

          try {
            const games: RawGame[] = await bggFetchCollection(username)

            // Capacity check — surface user-friendly error before any state mutation
            try {
              validateTierCapacity(games.length)
            } catch (e) {
              if (e instanceof TierCapacityError) {
                set({
                  view: 'error',
                  errorMessage:
                    'Your collection has ' +
                    e.gameCount +
                    ' games, which exceeds the 990-game limit. Remove some games from your BGG collection and try again.',
                })
                return
              }
              throw e
            }

            // Build games map
            const gamesMap: Record<string, Game> = {}
            for (const g of games) {
              gamesMap[g.id] = {
                id: g.id,
                name: g.name,
                yearPublished: g.yearPublished,
                thumbnail: g.thumbnail,
              }
            }

            // Initialize ratings (integer-internal per D-17)
            const ratings = initializeRankings(games.map((g) => g.id))

            // Compute first pair
            const firstPair = selectRandomPair(ratings, [])

            set({
              games: gamesMap,
              ratings,
              rankingsUsername: username,
              lastFetched: Date.now(),
              view: 'comparison',
              currentPair: firstPair,
              sessionComparisons: 0,
              skipQueue: [],
              loadingMessage: null,
              errorMessage: null,
            })
          } catch (err) {
            // Map technical errors to user-facing copy from UI-SPEC §Copywriting Contract
            const message = err instanceof Error ? err.message : String(err)
            let errorMessage: string

            if (message.includes('timed out after')) {
              errorMessage = "BGG didn't respond in time. Check your username and try again."
            } else if (message.includes('HTTP ')) {
              const match = /HTTP (\d+)/.exec(message)
              const status = match ? match[1] : '?'
              errorMessage = 'BGG returned an error (HTTP ' + status + '). Try again in a moment.'
            } else if (message.includes('HTML error page')) {
              errorMessage = "BGG didn't respond in time. Check your username and try again."
            } else if (message.includes('0 games')) {
              errorMessage = message
            } else {
              errorMessage = message
            }

            // CRITICAL: do NOT mutate ratings, games, rankingsUsername, or comparisonsTotal (T-02-04)
            set({ view: 'error', errorMessage, loadingMessage: null })
          }
        },

        continueSession(): void {
          const { ratings } = get()
          set({
            view: 'comparison',
            sessionComparisons: 0,
            skipQueue: [],
            currentPair: selectRandomPair(ratings, []),
          })
        },

        resetForNewUser(): void {
          set({
            ratings: {},
            games: {},
            rankingsUsername: null,
            comparisonsTotal: 0,
            sessionComparisons: 0,
            skipQueue: [],
            currentPair: null,
            view: 'entry',
            errorMessage: null,
            loadingMessage: null,
            lastFetched: null,
          })
        },

        pick(winnerId: string, loserId: string): void {
          const { ratings, comparisonsTotal, skipQueue, sessionComparisons } = get()
          const newRatings = applyUpset(winnerId, loserId, ratings)
          const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
          const nextPair = selectRandomPair(newRatings, newQueue)
          set({
            ratings: newRatings,
            comparisonsTotal: comparisonsTotal + 1,
            sessionComparisons: sessionComparisons + 1,
            currentPair: nextPair,
            skipQueue: newQueue,
          })
        },

        skip(): void {
          const { currentPair, skipQueue, ratings } = get()
          if (!currentPair) return
          set({
            skipQueue: [...skipQueue, currentPair],
            currentPair: selectRandomPair(ratings, []),
          })
        },

        refresh(): void {
          const newRatings = redistribute(get().ratings)
          set({
            ratings: newRatings,
            currentPair: selectRandomPair(newRatings, []),
          })
        },

        // --- Phase 3 actions (D-16) ---

        async login(username: string, password: string): Promise<void> {
          set({ view: 'loading', loadingMessage: 'Logging in to BGG…', errorMessage: null })
          try {
            const result = await bggLogin(username, password)
            set({ sessionId: result.sessionId, loadingMessage: 'Fetching your games…' })
            // Delegate collection fetch to existing action (D-03 sequential messages)
            await get().fetchCollection(username)
          } catch {
            set({
              view: 'error',
              errorMessage: 'Could not log in. Check your username and password.',
              loadingMessage: null,
            })
          }
        },

        async startSync(): Promise<void> {
          if (get().syncStatus === 'syncing') return  // guard re-entrancy
          const { ratings, sessionId, syncedGameIds } = get()
          if (!sessionId) return

          const allIds = Object.keys(ratings)
          const toSync = allIds.filter(id => !syncedGameIds.includes(id))

          set({
            view: 'syncing',
            syncStatus: 'syncing',
            syncProgress: syncedGameIds.length,
            syncTotal: allIds.length,
          })

          for (const gameId of toSync) {
            // Check per-iteration — cancelSync() sets sessionId=null to abort (Pitfall 4)
            const currentSessionId = get().sessionId
            if (!currentSessionId) return

            try {
              await bggRateGame(gameId, get().ratings[gameId], currentSessionId)
              // Re-check after the async write — user may have cancelled while awaiting
              if (!get().sessionId) return
              get().markGameSynced(gameId)
            } catch (err) {
              const status = (err as { status?: number }).status
              if (status === 401) {
                // Session expired mid-sync — prompt re-auth inline (D-09)
                set({ syncStatus: 'session-expired' })
                return
              }
              // Non-401 error: surface to user, stop sync
              set({ syncStatus: 'error' })
              return
            }

            // Throttle: 200–500ms random delay between writes (SYNC-02, T-03-05)
            await delay(200 + Math.floor(Math.random() * 300))
          }

          get().completeSyncAll()
        },

        markGameSynced(gameId: string): void {
          const { syncedGameIds, syncProgress } = get()
          set({
            syncedGameIds: [...syncedGameIds, gameId],
            syncProgress: syncProgress + 1,
          })
        },

        completeSyncAll(): void {
          const total = get().comparisonsTotal
          set({
            syncedGameIds: [],
            comparisonsAtLastSync: total,
            syncStatus: 'complete',
          })
          // Auto-return to comparison view after brief confirmation (D-07, ~2 seconds)
          setTimeout(() => set({ view: 'comparison', syncStatus: 'idle' }), 2000)
        },

        async reAuthAndResume(password: string): Promise<void> {
          const username = get().sessionUsername
          if (!username) {
            set({ syncStatus: 'error' })
            return
          }
          try {
            const result = await bggLogin(username, password)
            set({ sessionId: result.sessionId, syncStatus: 'syncing' })
            // Resume from where sync left off — syncedGameIds tracks already-sent games (D-10)
            await get().startSync()
          } catch {
            set({ syncStatus: 'error' })
          }
        },

        cancelSync(): void {
          // Setting sessionId=null triggers the per-iteration abort check in startSync (Pitfall 4)
          // Do NOT clear syncedGameIds — preserve for resume (Q2 resolution)
          set({ sessionId: null, view: 'comparison', syncStatus: 'idle' })
        },
      }),
      {
        name: 'bgg-ranker:v1:collection-and-rankings',
        storage,
        partialize: (state) => ({
          games: state.games,
          lastFetched: state.lastFetched,
          ratings: state.ratings,
          comparisonsTotal: state.comparisonsTotal,
          rankingsUsername: state.rankingsUsername,
          version: state.version,
          // Phase 3 additions — SYNC-03 resume anchor (D-14)
          // sessionId is NOT listed here — excluded per AUTH-03, D-13
          syncedGameIds: state.syncedGameIds,
          comparisonsAtLastSync: state.comparisonsAtLastSync,
        }),
      }
    )
  )
}

// ---------------------------------------------------------------------------
// Singleton store — consumed by React components
// ---------------------------------------------------------------------------

// Use a lazy factory so `localStorage` is only accessed in the browser (not during Node tests)
const _lazyStorage: StateStorage = {
  getItem: (name) => (typeof localStorage !== 'undefined' ? localStorage.getItem(name) : null),
  setItem: (name, value) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(name)
  },
}

export const useStore = createAppStore(_lazyStorage)
