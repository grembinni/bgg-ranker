import { useState, useRef } from 'react'
import { useStore } from '../store/store'

export default function Header() {
  const sessionUsername = useStore(s => s.sessionUsername)
  const dirtyGameIds = useStore(s => s.dirtyGameIds)
  const unplayedIds = useStore(s => s.unplayedIds)
  const refresh = useStore(s => s.refresh)
  const startSync = useStore(s => s.startSync)
  const showRankedList = useStore(s => s.showRankedList)
  const showRankedGrid = useStore(s => s.showRankedGrid)
  const showUnplayedList = useStore(s => s.showUnplayedList)
  const backToComparison = useStore(s => s.backToComparison)
  const sessionId = useStore(s => s.sessionId)
  const logout = useStore(s => s.logout)
  const view = useStore(s => s.view)

  const syncCount = dirtyGameIds.length
  const syncDisabled = !sessionId || syncCount === 0

  const [menuOpen, setMenuOpen] = useState(false)
  const menuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMenuEnter = () => { if (menuCloseTimer.current) { clearTimeout(menuCloseTimer.current); menuCloseTimer.current = null } }
  const handleMenuLeave = () => { menuCloseTimer.current = setTimeout(() => setMenuOpen(false), 150) }
  const handleSync = () => { setMenuOpen(false); startSync() }
  const handleRefresh = () => { setMenuOpen(false); refresh() }
  const handleUnplayed = () => { setMenuOpen(false); showUnplayedList() }
  const handleLogout = () => { setMenuOpen(false); logout() }

  return (
    <div className="relative z-30 max-w-6xl mx-auto px-4 pt-8">
      <header className="grid grid-cols-3 items-center mb-8 text-base text-gray-700">
        <div className="relative justify-self-start" onMouseEnter={handleMenuEnter} onMouseLeave={handleMenuLeave}>
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
                onClick={handleUnplayed}
                className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
              >
                Unplayed ({unplayedIds.length})
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
        <div className="flex gap-2 justify-self-center">
          <button
            type="button"
            onClick={backToComparison}
            aria-label="Comparison view"
            className={`px-3 py-1.5 rounded text-sm ${view === 'comparison' ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            ⚔
          </button>
          <button
            type="button"
            onClick={showRankedList}
            aria-label="Ranked list view"
            className={`px-3 py-1.5 rounded text-sm ${view === 'ranked-list' ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            ☰
          </button>
          <button
            type="button"
            onClick={showRankedGrid}
            aria-label="Grid view"
            className={`px-3 py-1.5 rounded text-sm ${view === 'ranked-grid' ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            ⊞
          </button>
        </div>
        <span className="justify-self-end">{sessionUsername}</span>
      </header>
    </div>
  )
}
