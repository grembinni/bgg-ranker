import { useStore } from '../store/store'

export default function UnplayedListView() {
  const unplayedIds = useStore(s => s.unplayedIds)
  const games = useStore(s => s.games)
  const backToComparison = useStore(s => s.backToComparison)

  const sorted = [...unplayedIds]
    .map(id => ({ id, game: games[id] }))
    .sort((a, b) => {
      const na = a.game?.name ?? a.id
      const nb = b.game?.name ?? b.id
      return na.localeCompare(nb)
    })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Unplayed ({sorted.length} games)</h1>
        <button
          type="button"
          onClick={backToComparison}
          className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          ← Back
        </button>
      </header>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No games marked as unplayed yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {sorted.map(({ id, game }) => (
            <li key={id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {game?.name ?? id}
                </p>
                {game?.yearPublished ? (
                  <p className="text-xs text-gray-400">{game.yearPublished}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
