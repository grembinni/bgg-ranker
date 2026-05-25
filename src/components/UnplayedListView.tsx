import { useState } from 'react'
import { useStore } from '../store/store'

interface RowProps {
  id: string
  name: string
  year: number | undefined
  totalRanked: number
  onMove: (id: string, rank: number) => void
}

function UnplayedRow({ id, name, year, totalRanked, onMove }: RowProps) {
  const [rankInput, setRankInput] = useState('')

  const max = totalRanked + 1

  function handleAdd() {
    const val = parseInt(rankInput, 10)
    if (isNaN(val) || val < 1 || val > max) return
    onMove(id, val)
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        {year ? <p className="text-xs text-gray-400">{year}</p> : null}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min={1}
          max={max}
          value={rankInput}
          onChange={e => setRankInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={`1–${max}`}
          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`Rank for ${name}`}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={rankInput === ''}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </li>
  )
}

export default function UnplayedListView() {
  const unplayedIds = useStore(s => s.unplayedIds)
  const ratings = useStore(s => s.ratings)
  const games = useStore(s => s.games)
  const backToComparison = useStore(s => s.backToComparison)
  const moveUnplayedToRanked = useStore(s => s.moveUnplayedToRanked)

  const totalRanked = Object.keys(ratings).length

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
        <>
          <p className="text-xs text-gray-400 mb-3">Enter a rank (1–{totalRanked + 1}) to move a game back into your ranked list.</p>
          <ul className="divide-y divide-gray-100">
            {sorted.map(({ id, game }) => (
              <UnplayedRow
                key={id}
                id={id}
                name={game?.name ?? id}
                year={game?.yearPublished}
                totalRanked={totalRanked}
                onMove={moveUnplayedToRanked}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
