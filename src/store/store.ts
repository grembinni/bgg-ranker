/**
 * store.ts — Zustand App Store
 *
 * All API calls flow through store actions — UI components never import bggClient directly (CLAUDE.md).
 * sessionUsername (ephemeral, not persisted, AUTH-03 discipline) vs rankingsUsername (persisted, PERSIST-02 guard per D-09).
 * Ratings stored as integers: 801 = 8.01 (divide by 100 only at display/sync time).
 * localStorage key: bgg-ranker:v1:collection-and-rankings
 */

import { create, type StoreApi } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { fetchCollection as bggFetchCollection, type RawGame } from '../api/bggClient'
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
}

interface ComparisonStateSlice {
  view: 'entry' | 'loading' | 'comparison' | 'error'
  currentPair: [string, string] | null
  sessionComparisons: number
  skipQueue: Array<[string, string]>
  loadingMessage: string | null
  errorMessage: string | null
}

interface AppActions {
  setSessionUsername(username: string): void
  fetchCollection(username: string): Promise<void>
  continueSession(): void
  resetForNewUser(): void
  pick(winnerId: string, loserId: string): void
  skip(): void
  refresh(): void
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
// Store factory (injectable storage for testing)
// ---------------------------------------------------------------------------

/**
 * createAppStore — Factory that creates the Zustand store with inject-able storage.
 *
 * @param rawStorage - Raw StateStorage adapter; wrapped with createJSONStorage internally.
 *                     In tests, pass createMockStorage(). In the browser, pass localStorage.
 * @returns StoreApi<AppStore>
 */
export function createAppStore(rawStorage: StateStorage): StoreApi<AppStore> {
  const storage = createJSONStorage(() => rawStorage)
  return create<AppStore>()(
    persist(
      (set, get) => ({
        // --- Initial state ---
        sessionUsername: null,
        games: {},
        lastFetched: null,
        ratings: {},
        comparisonsTotal: 0,
        rankingsUsername: null,
        version: 1,
        view: 'entry',
        currentPair: null,
        sessionComparisons: 0,
        skipQueue: [],
        loadingMessage: null,
        errorMessage: null,

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
          const nextPair =
            skipQueue.length > 0 ? skipQueue[0] : selectRandomPair(newRatings, [])
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
