import { useState } from 'react'
import { useStore } from '../store/store'
import GameCard from './GameCard'

export default function ComparisonView() {
  const currentPair = useStore(s => s.currentPair)
  const sessionComparisons = useStore(s => s.sessionComparisons)
  const comparisonsTotal = useStore(s => s.comparisonsTotal)
  const sessionUsername = useStore(s => s.sessionUsername)
  const dirtyGameIds = useStore(s => s.dirtyGameIds)
  const unplayedIds = useStore(s => s.unplayedIds)
  const pick = useStore(s => s.pick)
  const skip = useStore(s => s.skip)
  const refresh = useStore(s => s.refresh)
  const startSync = useStore(s => s.startSync)
  const markUnplayed = useStore(s => s.markUnplayed)
  const showRankedList = useStore(s => s.showRankedList)
  const showRankedGrid = useStore(s => s.showRankedGrid)
  const showUnplayedList = useStore(s => s.showUnplayedList)
  const sessionId = useStore(s => s.sessionId)
  const lastUpset = useStore(s => s.lastUpset)
  const logout = useStore(s => s.logout)

  const syncCount = dirtyGameIds.length
  const syncDisabled = !sessionId || syncCount === 0

  const [menuOpen, setMenuOpen] = useState(false)
  const handleSync = () => { setMenuOpen(false); startSync() }
  const handleRefresh = () => { setMenuOpen(false); refresh() }
  const handleLogout = () => { setMenuOpen(false); logout() }

  if (currentPair === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-base text-gray-700">No pair available. This shouldn't happen with a valid collection.</p>
      </div>
    )
  }

  const [leftId, rightId] = currentPair

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8 text-base text-gray-700">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
            aria-label="Menu"
          >
            ☰
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded shadow-sm z-20 flex flex-col">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncDisabled}
                className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sync to BGG ({syncCount})
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
              >
                Refresh rankings
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
        <span>{sessionComparisons} this session · {comparisonsTotal} total</span>
        <span>{sessionUsername}</span>
      </header>
      <div className="grid grid-cols-2 gap-6">
        <GameCard
          gameId={leftId}
          onPick={() => pick(leftId, rightId)}
          onMarkUnplayed={() => markUnplayed(leftId)}
        />
        <GameCard
          gameId={rightId}
          onPick={() => pick(rightId, leftId)}
          onMarkUnplayed={() => markUnplayed(rightId)}
        />
      </div>
      {lastUpset !== null && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-2 text-center text-sm mt-4">
          {lastUpset.winnerName} moved up {lastUpset.spotsGained} {lastUpset.spotsGained === 1 ? 'spot' : 'spots'}
        </div>
      )}
      <div className="flex gap-4 justify-center mt-8">
        <button
          type="button"
          onClick={skip}
          className="px-6 py-2 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={showRankedList}
          className="px-6 py-2 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          ☰ Ranked list
        </button>
        <button
          type="button"
          onClick={showRankedGrid}
          className="px-6 py-2 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          ⊞ Grid view
        </button>
        <button
          type="button"
          onClick={showUnplayedList}
          className="px-6 py-2 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          Unplayed ({unplayedIds.length})
        </button>
      </div>
    </div>
  )
}
