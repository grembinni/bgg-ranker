import { useStore } from '../store/store'

interface GameCardProps {
  gameId: string
  onPick: () => void
}

function getRankPosition(gameId: string, ratings: Record<string, number>): number {
  const sorted = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  return sorted.findIndex(([id]) => id === gameId) + 1
}

export default function GameCard({ gameId, onPick }: GameCardProps) {
  const game = useStore(s => s.games[gameId])
  const ratings = useStore(s => s.ratings)

  if (game === undefined) return null

  const totalGames = Object.keys(ratings).length
  const rank = getRankPosition(gameId, ratings)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
      <div className="text-xl font-semibold text-gray-900 leading-tight">{game.name}</div>
      <div className="text-sm text-gray-500">({game.yearPublished})</div>
      <div className="text-sm text-gray-500">#{rank} of {totalGames}</div>
      <button
        type="button"
        onClick={onPick}
        className="mt-auto w-full min-h-[44px] bg-blue-600 text-white text-base font-semibold rounded px-4 py-2 hover:bg-blue-700 active:bg-blue-800 outline-2 outline-offset-2 outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Pick this game
      </button>
    </div>
  )
}
