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
  userRating?: number | null  // BGG personal rating at time of fetch; optional for localStorage compat
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
  dirtyGameIds: string[]          // persisted — set of game IDs whose ratings need syncing (D-04)
  comparisonsAtLastSync: number   // persisted — retained for display/metrics only (D-12, D-14)
  unplayedIds: string[]           // persisted — games marked as not yet played
  // Both start at 0: button disabled until first comparison (Pitfall 5)
}

interface ComparisonStateSlice {
  view: 'entry' | 'loading' | 'comparison' | 'error' | 'syncing' | 'ranked-list' | 'unplayed-list'
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
  markUnplayed(gameId: string): void
  reorderRankedList(newOrderedIds: string[]): void
  moveUnplayedToRanked(gameId: string, targetRank: number): void
  showRankedList(): void
  showUnplayedList(): void
  backToComparison(): void
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

/**
 * completeSyncTimer — Tracks the setTimeout handle from completeSyncAll so it
 * can be cancelled by cancelSync or resetForNewUser (WR-03).
 */
let completeSyncTimer: ReturnType<typeof setTimeout> | null = null

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
        dirtyGameIds: [],
        comparisonsAtLastSync: 0,
        unplayedIds: [],
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
            const games: RawGame[] = await bggFetchCollection(username, get().sessionId ?? undefined)

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
                userRating: g.userRating,
              }
            }

            // Seed from BGG ratings: rated games descending, unrated shuffled after
            const ratedGames = games
              .filter(g => g.userRating !== null)
              .sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0))
            const unratedGames = games
              .filter(g => g.userRating === null)
              .sort(() => Math.random() - 0.5)
            const orderedIds = [...ratedGames, ...unratedGames].map(g => g.id)
            const ratings = initializeRankings(orderedIds, undefined, true)

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
              // All freshly-seeded games need a sync to BGG (D-04)
              dirtyGameIds: Object.keys(ratings),
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
          if (completeSyncTimer) { clearTimeout(completeSyncTimer); completeSyncTimer = null }
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
            unplayedIds: [],
            dirtyGameIds: [],
          })
        },

        pick(winnerId: string, loserId: string): void {
          const { ratings, comparisonsTotal, skipQueue, sessionComparisons, dirtyGameIds } = get()
          const newRatings = applyUpset(winnerId, loserId, ratings)
          const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
          // Delegate to selectRandomPair with the pre-drain queue so it returns
          // skipQueue[0] when non-empty (drain semantics live in selectRandomPair, WR-01)
          const nextPair = selectRandomPair(newRatings, skipQueue)
          // Diff old vs new ratings to find only changed game IDs (precise dirty marking)
          const changed = Object.keys(newRatings).filter(id => newRatings[id] !== ratings[id])
          const newDirty = [...new Set([...dirtyGameIds, ...changed])]
          set({
            ratings: newRatings,
            comparisonsTotal: comparisonsTotal + 1,
            sessionComparisons: sessionComparisons + 1,
            currentPair: nextPair,
            skipQueue: newQueue,
            dirtyGameIds: newDirty,
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
            dirtyGameIds: Object.keys(newRatings),
            currentPair: selectRandomPair(newRatings, []),
          })
        },

        markUnplayed(gameId: string): void {
          const { ratings, unplayedIds, skipQueue, dirtyGameIds } = get()
          const newRatings = { ...ratings }
          delete newRatings[gameId]
          const newQueue = skipQueue.filter(([a, b]) => a !== gameId && b !== gameId)
          set({
            ratings: newRatings,
            unplayedIds: [...unplayedIds, gameId],
            // Mark dirty so next sync sends rating=0 (removes rating from BGG)
            dirtyGameIds: [...new Set([...dirtyGameIds, gameId])],
            skipQueue: newQueue,
            currentPair: selectRandomPair(newRatings, newQueue),
          })
        },

        reorderRankedList(newOrderedIds: string[]): void {
          const newRatings = initializeRankings(newOrderedIds, undefined, true)
          set({
            ratings: newRatings,
            // initializeRankings redistributes all ratings — mark every game dirty
            dirtyGameIds: [...new Set([...get().dirtyGameIds, ...newOrderedIds])],
            // Treat a manual reorder as a comparison so the Sync button activates
            comparisonsTotal: get().comparisonsTotal + 1,
          })
        },

        moveUnplayedToRanked(gameId: string, targetRank: number): void {
          const { ratings, unplayedIds } = get()
          if (!unplayedIds.includes(gameId)) return
          const sorted = Object.entries(ratings)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => id)
          const insertIdx = Math.max(0, Math.min(targetRank - 1, sorted.length))
          const newOrder = [...sorted.slice(0, insertIdx), gameId, ...sorted.slice(insertIdx)]
          const newRatings = initializeRankings(newOrder, undefined, true)
          set({
            ratings: newRatings,
            unplayedIds: unplayedIds.filter(id => id !== gameId),
            // initializeRankings redistributes all ratings — mark every game in newOrder dirty
            dirtyGameIds: [...new Set([...get().dirtyGameIds, ...newOrder])],
            comparisonsTotal: get().comparisonsTotal + 1,
          })
        },

        showRankedList(): void { set({ view: 'ranked-list' }) },
        showUnplayedList(): void { set({ view: 'unplayed-list' }) },
        backToComparison(): void { set({ view: 'comparison' }) },

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
              sessionId: null,   // discard orphaned token on login failure
            })
          }
        },

        async startSync(): Promise<void> {
          if (get().syncStatus === 'syncing') return  // guard re-entrancy
          const { dirtyGameIds, sessionId } = get()
          if (!sessionId) return

          // Snapshot dirty set — iterate a copy so in-flight markGameSynced() removals are safe
          const toSync = [...dirtyGameIds]

          set({
            view: 'syncing',
            syncStatus: 'syncing',
            syncProgress: 0,
            syncTotal: toSync.length,
          })

          for (const gameId of toSync) {
            // Check per-iteration — cancelSync() sets sessionId=null to abort (Pitfall 4)
            const currentSessionId = get().sessionId
            if (!currentSessionId) return

            // Unplayed games sync with null (rating=0 removes the rating from BGG)
            const ratingInt = get().unplayedIds.includes(gameId) ? null : get().ratings[gameId]
            // Guard: skip games that are dirty but no longer in ratings (evicted between snapshots)
            if (ratingInt === undefined) continue
            try {
              await bggRateGame(gameId, ratingInt, currentSessionId)
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

            // Throttle: fixed 1000ms delay between writes (SYNC-02, T-03-05)
            await delay(1000)
          }

          get().completeSyncAll()
        },

        markGameSynced(gameId: string): void {
          set({
            dirtyGameIds: get().dirtyGameIds.filter(id => id !== gameId),
            syncProgress: get().syncProgress + 1,
          })
        },

        completeSyncAll(): void {
          if (completeSyncTimer) clearTimeout(completeSyncTimer)
          set({
            comparisonsAtLastSync: get().comparisonsTotal,
            syncStatus: 'complete',
            // dirtyGameIds is already empty after all markGameSynced() calls; no explicit reset needed
          })
          // Auto-return to comparison view after brief confirmation (D-07, ~2 seconds)
          completeSyncTimer = setTimeout(() => {
            completeSyncTimer = null
            set({ view: 'comparison', syncStatus: 'idle' })
          }, 2000)
        },

        async reAuthAndResume(password: string): Promise<void> {
          const username = get().sessionUsername
          if (!username) {
            set({ syncStatus: 'error' })
            return
          }
          try {
            const result = await bggLogin(username, password)
            // Reset syncStatus to 'idle' so startSync's re-entrancy guard allows the call
            set({ sessionId: result.sessionId, syncStatus: 'idle' })
            // Resume from where sync left off — dirtyGameIds contains remaining un-synced games (D-10)
            await get().startSync()
          } catch {
            set({ syncStatus: 'error' })
          }
        },

        cancelSync(): void {
          // Setting sessionId=null triggers the per-iteration abort check in startSync (Pitfall 4)
          // dirtyGameIds retains remaining un-synced IDs — resume picks them up on next startSync
          if (completeSyncTimer) { clearTimeout(completeSyncTimer); completeSyncTimer = null }
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
          // Phase 3.1 dirty tracking — persisted so unsynced games survive page reload (D-04)
          // sessionId is NOT listed here — excluded per AUTH-03, D-13
          dirtyGameIds: state.dirtyGameIds,
          comparisonsAtLastSync: state.comparisonsAtLastSync,
          unplayedIds: state.unplayedIds,
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
