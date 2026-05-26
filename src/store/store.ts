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

export interface Game {
  id: string
  collId: string             // BGG collection-item ID for PUT /api/collectionitem/{collId}
  name: string
  yearPublished: number
  thumbnail: string
  userRating?: number | null  // BGG personal rating at time of fetch; optional for localStorage compat
}

interface SessionStateSlice {
  sessionUsername: string | null // ephemeral — NEVER in partialize (AUTH-03)
  sessionId: string | null       // ephemeral — NEVER in partialize (AUTH-03)
}

interface CollectionStateSlice {
  games: Record<string, Game>
  lastFetched: number | null
}

interface RankingsStateSlice {
  ratings: Record<string, number>            // integer-internal: 801 = 8.01
  lastSyncedRatings: Record<string, number>  // snapshot at last completeSyncAll — suppresses reload dirty noise from stale BGG responses
  comparisonsTotal: number
  rankingsUsername: string | null
  version: number
  dirtyGameIds: string[]
  comparisonsAtLastSync: number
  unplayedIds: string[]
}

interface ComparisonStateSlice {
  view: 'entry' | 'loading' | 'comparison' | 'error' | 'syncing' | 'ranked-list' | 'unplayed-list'
  currentPair: [string, string] | null
  sessionComparisons: number
  skipQueue: Array<[string, string]>
  loadingMessage: string | null
  errorMessage: string | null
  syncStatus: 'idle' | 'syncing' | 'session-expired' | 'error' | 'complete'
  syncProgress: number
  syncTotal: number
  syncErrorDetail: string | null
  lastUpset: { winnerName: string; spotsGained: number } | null
}

interface AppActions {
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
  login(username: string, password: string): Promise<void>
  startSync(): Promise<void>
  markGameSynced(gameId: string): void
  completeSyncAll(): void
  reAuthAndResume(password: string): Promise<void>
  cancelSync(): void
  logout(): void
}

export type AppStore = SessionStateSlice &
  CollectionStateSlice &
  RankingsStateSlice &
  ComparisonStateSlice &
  AppActions

// Exported for unit testing. Picks tier-adjacent pairs (±1 tier); falls back to any partner
// when no adjacent candidate exists. Drains skipQueue front when non-empty.
export function selectRandomPair(
  ratings: Record<string, number>,
  skipQueue: Array<[string, string]>
): [string, string] | null {
  if (skipQueue.length > 0) {
    return skipQueue[0]
  }

  const ids = Object.keys(ratings)
  if (ids.length < 2) return null

  const anchorIdx = Math.floor(Math.random() * ids.length)
  const anchorId = ids[anchorIdx]
  const anchorTier = Math.ceil(ratings[anchorId] / 100)

  const adjacent = ids.filter(id => {
    if (id === anchorId) return false
    return Math.abs(Math.ceil(ratings[id] / 100) - anchorTier) <= 1
  })

  const pool = adjacent.length > 0 ? adjacent : ids.filter(id => id !== anchorId)
  return [anchorId, pool[Math.floor(Math.random() * pool.length)]]
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let completeSyncTimer: ReturnType<typeof setTimeout> | null = null
let upsetTimer: ReturnType<typeof setTimeout> | null = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createAppStore(rawStorage: StateStorage) {
  const storage = createJSONStorage(() => rawStorage)
  return create<AppStore>()(
    persist(
      (set, get) => ({
        sessionUsername: null,
        sessionId: null,
        games: {},
        lastFetched: null,
        ratings: {},
        lastSyncedRatings: {},
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
        syncErrorDetail: null,
        lastUpset: null,

        async fetchCollection(username: string): Promise<void> {
          set({
            sessionUsername: username,
            view: 'loading',
            loadingMessage: 'Fetching your games from BGG. This may take a moment.',
            errorMessage: null,
          })

          try {
            const games: RawGame[] = await bggFetchCollection(username, get().sessionId ?? undefined)

            // Capacity limit applies to rated games only — unrated games go to the unplayed list
            const ratedCount = games.filter(g => g.userRating !== null).length
            try {
              validateTierCapacity(ratedCount)
            } catch (e) {
              if (e instanceof TierCapacityError) {
                set({
                  view: 'error',
                  errorMessage:
                    'Your rated collection has ' +
                    e.gameCount +
                    ' games, which exceeds the 990-game limit. Remove some games from your BGG collection and try again.',
                })
                return
              }
              throw e
            }

            const gamesMap: Record<string, Game> = {}
            for (const g of games) {
              gamesMap[g.id] = {
                id: g.id,
                collId: g.collId,
                name: g.name,
                yearPublished: g.yearPublished,
                thumbnail: g.thumbnail,
                userRating: g.userRating,
              }
            }

            // Seed ranked list from BGG-rated games in descending rating order.
            // Unrated games go to the unplayed list.
            const ratedGames = games
              .filter(g => g.userRating !== null)
              .sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0))
            const unratedIds = games
              .filter(g => g.userRating === null)
              .map(g => g.id)
            const orderedIds = ratedGames.map(g => g.id)
            const ratings = initializeRankings(orderedIds, undefined, true)

            // Mark dirty if app-computed rating differs from BGG's stored rating.
            // Skip re-dirtying when the rating matches lastSyncedRatings — BGG's collection API
            // can return stale data for a short window after a PUT, and we don't want a fresh login
            // immediately after a full sync to create spurious dirty games.
            const lastSynced = get().lastSyncedRatings
            const dirtyGameIds = ratedGames
              .filter(g => {
                const newRating = ratings[g.id]
                if (lastSynced[g.id] === newRating) return false
                return newRating !== Math.round((g.userRating as number) * 100)
              })
              .map(g => g.id)

            const firstPair = selectRandomPair(ratings, [])

            set({
              games: gamesMap,
              ratings,
              rankingsUsername: username,
              lastFetched: Date.now(),
              view: 'comparison',
              currentPair: firstPair,
              sessionComparisons: 0,
              comparisonsTotal: 0,
              skipQueue: [],
              loadingMessage: null,
              errorMessage: null,
              unplayedIds: unratedIds,
              dirtyGameIds,
            })
          } catch (err) {
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

            // CRITICAL: do NOT mutate ratings, games, rankingsUsername, or comparisonsTotal on error
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
          if (upsetTimer) { clearTimeout(upsetTimer); upsetTimer = null }
          set({
            ratings: {},
            lastSyncedRatings: {},
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
          const { ratings, comparisonsTotal, skipQueue, sessionComparisons, dirtyGameIds, games } = get()

          // Compute pre-upset positions before applyUpset mutates the ranking
          const ranked = Object.entries(ratings).sort((a, b) => b[1] - a[1])
          const winnerPos = ranked.findIndex(([id]) => id === winnerId)
          const loserPos = ranked.findIndex(([id]) => id === loserId)

          const newRatings = applyUpset(winnerId, loserId, ratings)
          const newQueue = skipQueue.length > 0 ? skipQueue.slice(1) : skipQueue
          const nextPair = selectRandomPair(newRatings, skipQueue)
          const changed = Object.keys(newRatings).filter(id => newRatings[id] !== ratings[id])
          const newDirty = [...new Set([...dirtyGameIds, ...changed])]

          let newLastUpset: { winnerName: string; spotsGained: number } | null = null
          if (winnerPos > loserPos && winnerPos !== -1 && loserPos !== -1) {
            const spotsGained = winnerPos - loserPos
            const winnerName = games[winnerId]?.name ?? winnerId
            newLastUpset = { winnerName, spotsGained }
            // Cancel previous timer before setting new one — prevents timer leak on rapid picks
            if (upsetTimer) { clearTimeout(upsetTimer); upsetTimer = null }
            upsetTimer = setTimeout(() => {
              upsetTimer = null
              set({ lastUpset: null })
            }, 5000)
          }

          set({
            ratings: newRatings,
            comparisonsTotal: comparisonsTotal + 1,
            sessionComparisons: sessionComparisons + 1,
            currentPair: nextPair,
            skipQueue: newQueue,
            dirtyGameIds: newDirty,
            lastUpset: newLastUpset,
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
            // rating=0 on next sync removes the rating from BGG
            dirtyGameIds: [...new Set([...dirtyGameIds, gameId])],
            skipQueue: newQueue,
            currentPair: selectRandomPair(newRatings, newQueue),
          })
        },

        reorderRankedList(newOrderedIds: string[]): void {
          const prevRatings = get().ratings
          const newRatings = initializeRankings(newOrderedIds, undefined, true)
          const changedIds = newOrderedIds.filter(id => newRatings[id] !== prevRatings[id])
          set({
            ratings: newRatings,
            dirtyGameIds: [...new Set([...get().dirtyGameIds, ...changedIds])],
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
          const prevRatings2 = get().ratings
          const newRatings = initializeRankings(newOrder, undefined, true)
          const changedIds = newOrder.filter(id => newRatings[id] !== prevRatings2[id])
          set({
            ratings: newRatings,
            unplayedIds: unplayedIds.filter(id => id !== gameId),
            dirtyGameIds: [...new Set([...get().dirtyGameIds, ...changedIds])],
            comparisonsTotal: get().comparisonsTotal + 1,
          })
        },

        showRankedList(): void { set({ view: 'ranked-list' }) },
        showUnplayedList(): void { set({ view: 'unplayed-list' }) },
        backToComparison(): void { set({ view: 'comparison' }) },

        async login(username: string, password: string): Promise<void> {
          set({ view: 'loading', loadingMessage: 'Logging in to BGG…', errorMessage: null })
          try {
            const result = await bggLogin(username, password)
            set({ sessionId: result.sessionId, sessionUsername: username })
            const { rankingsUsername, ratings, games } = get()
            if (
              rankingsUsername === username &&
              Object.keys(ratings).length > 0 &&
              Object.keys(games).length > 0
            ) {
              get().continueSession()
              return
            }
            set({ loadingMessage: 'Fetching your games…' })
            await get().fetchCollection(username)
          } catch {
            set({
              view: 'error',
              errorMessage: 'Could not log in. Check your username and password.',
              loadingMessage: null,
              sessionId: null,
            })
          }
        },

        async startSync(): Promise<void> {
          if (get().syncStatus === 'syncing') return  // guard re-entrancy
          const { dirtyGameIds, sessionId } = get()
          if (!sessionId) return

          // One-time migration: localStorage data predating the collId field will have games
          // without collId. Re-fetch the collection to patch collId without touching ratings.
          if (dirtyGameIds.some(id => !get().games[id]?.collId)) {
            const username = get().sessionUsername
            if (username) {
              try {
                const freshGames = await bggFetchCollection(username, sessionId)
                const patchedGames = { ...get().games }
                for (const g of freshGames) {
                  if (patchedGames[g.id]) {
                    patchedGames[g.id] = { ...patchedGames[g.id], collId: g.collId }
                  }
                }
                set({ games: patchedGames })
              } catch { /* proceed — games still missing collId will be skipped individually */ }
            }
          }

          const syncQueue = [...get().dirtyGameIds]

          set({
            view: 'syncing',
            syncStatus: 'syncing',
            syncProgress: 0,
            syncTotal: syncQueue.length,
            syncErrorDetail: null,
          })

          for (let i = 0; i < syncQueue.length; i++) {
            const gameId = syncQueue[i]
            // Check per-iteration — cancelSync() sets sessionId=null to abort
            const currentSessionId = get().sessionId
            if (!currentSessionId) return

            const ratingInt = get().unplayedIds.includes(gameId) ? null : get().ratings[gameId]
            if (ratingInt === undefined) continue
            const game = get().games[gameId]
            if (!game?.collId) continue
            try {
              await bggRateGame(game.collId, game.id, ratingInt, currentSessionId)
              if (!get().sessionId) return
              get().markGameSynced(gameId)
            } catch (err) {
              const status = (err as { status?: number }).status
              if (status === 401) {
                set({ syncStatus: 'session-expired' })
                return
              }
              const body = (err as { body?: string }).body
              const detail = `${status ? `HTTP ${status}` : 'network error'}${body ? ` — ${body}` : ''}`
              set({ syncStatus: 'error', syncErrorDetail: detail })
              return
            }

            // Throttle between writes — skip delay after the last game
            if (i < syncQueue.length - 1) await delay(500)
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
            lastSyncedRatings: { ...get().ratings },
            syncStatus: 'complete',
            sessionComparisons: 0,
          })
          // Auto-return to comparison view after brief confirmation (~2 seconds)
          completeSyncTimer = setTimeout(() => {
            completeSyncTimer = null
            set({ view: 'comparison', syncStatus: 'idle' })
          }, 2000)
        },

        async reAuthAndResume(password: string): Promise<void> {
          const username = get().sessionUsername
          if (!username) {
            set({ syncStatus: 'error', syncErrorDetail: 'no session username' })
            return
          }
          try {
            const result = await bggLogin(username, password)
            // Reset syncStatus so startSync's re-entrancy guard allows the call
            set({ sessionId: result.sessionId, syncStatus: 'idle' })
            if (get().dirtyGameIds.length === 0) {
              set({ view: 'comparison' })
              return
            }
            await get().startSync()
          } catch (err) {
            const status = (err as { status?: number }).status
            const body = (err as { body?: string }).body
            const detail = `${status ? `HTTP ${status}` : 'network error'}${body ? ` — ${body}` : ''}`
            set({ syncStatus: 'error', syncErrorDetail: detail })
          }
        },

        cancelSync(): void {
          // Setting sessionId=null triggers the per-iteration abort check in startSync
          if (completeSyncTimer) { clearTimeout(completeSyncTimer); completeSyncTimer = null }
          set({ sessionId: null, view: 'comparison', syncStatus: 'idle' })
        },

        logout(): void {
          get().cancelSync()
          // Clear session fields; do NOT clear ratings/games/rankingsUsername
          set({ sessionId: null, sessionUsername: null, view: 'entry' })
        },
      }),
      {
        name: 'bgg-ranker:v1:collection-and-rankings',
        storage,
        partialize: (state) => ({
          games: state.games,
          lastFetched: state.lastFetched,
          ratings: state.ratings,
          lastSyncedRatings: state.lastSyncedRatings,
          comparisonsTotal: state.comparisonsTotal,
          rankingsUsername: state.rankingsUsername,
          version: state.version,
          // sessionId excluded per AUTH-03 — never persisted
          dirtyGameIds: state.dirtyGameIds,
          comparisonsAtLastSync: state.comparisonsAtLastSync,
          unplayedIds: state.unplayedIds,
        }),
      }
    )
  )
}

// Lazy localStorage access so it only runs in the browser, not during Node tests
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
