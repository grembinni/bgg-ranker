import { useStore } from '../store/store'

interface GameCardProps {
  gameId: string
  onPick: () => void
  onMarkUnplayed: () => void
}

function getRankPosition(gameId: string, ratings: Record<string, number>): number {
  const sorted = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  return sorted.findIndex(([id]) => id === gameId) + 1
}

export default function GameCard({ gameId, onPick, onMarkUnplayed }: GameCardProps) {
  const game = useStore(s => s.games[gameId])
  const ratings = useStore(s => s.ratings)

  if (game === undefined) return null

  const totalGames = Object.keys(ratings).length
  const rank = getRankPosition(gameId, ratings)

  return (
    <div className="relative bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={onMarkUnplayed}
        title="Mark as unplayed"
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-bold rounded"
      >
        ✕
      </button>
      {game.thumbnail && (
        <img
          src={game.thumbnail.startsWith('//') ? `https:${game.thumbnail}` : game.thumbnail}
          alt={game.name}
          className="w-full h-32 object-contain"
        />
      )}
      <div className="text-xl font-semibold text-gray-900 leading-tight">{game.name}</div>
      <div className="text-sm text-gray-500">({game.yearPublished})</div>
      <div className="text-sm text-gray-500">#{rank} of {totalGames}</div>
      <button
        type="button"
        onClick={onPick}
        className="mt-auto w-full min-h-[44px] bg-blue-600 text-white text-base font-semibold rounded px-4 py-2 hover:bg-blue-700 active:bg-blue-800 outline-2 outline-offset-2 outline-blue-600"
      >
        Pick this game
      </button>
    </div>
  )
}
