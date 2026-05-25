import { useStore } from '../store/store'

export default function RankedListView() {
  const ratings = useStore(s => s.ratings)
  const games = useStore(s => s.games)
  const backToComparison = useStore(s => s.backToComparison)

  const ranked = Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])
    .map(([id, ratingInt], idx) => ({
      id,
      game: games[id],
      rank: idx + 1,
      rating: (ratingInt / 100).toFixed(2),
    }))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Rankings ({ranked.length} games)</h1>
        <button
          type="button"
          onClick={backToComparison}
          className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          ← Back
        </button>
      </header>
      <ol className="divide-y divide-gray-100">
        {ranked.map(({ id, game, rank, rating }) => (
          <li key={id} className="flex items-center gap-4 py-3">
            <span className="w-10 text-right text-sm font-mono text-gray-400 shrink-0">#{rank}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {game?.name ?? id}
              </p>
              {game?.yearPublished ? (
                <p className="text-xs text-gray-400">{game.yearPublished}</p>
              ) : null}
            </div>
            <span className="text-sm font-mono text-gray-500 shrink-0">{rating}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
