import { useStore } from '../store/store'
import GameCard from './GameCard'

export default function ComparisonView() {
  const currentPair = useStore(s => s.currentPair)
  const pick = useStore(s => s.pick)
  const skip = useStore(s => s.skip)
  const markUnplayed = useStore(s => s.markUnplayed)
  const lastUpset = useStore(s => s.lastUpset)

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
      <div className="grid grid-cols-[1fr_1fr_auto] items-stretch gap-6">
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
        <button
          type="button"
          onClick={skip}
          className="h-full px-6 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-medium rounded outline-2 outline-offset-2 outline-red-600 flex items-center justify-center"
        >
          Skip
        </button>
      </div>
      {lastUpset !== null && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-2 text-center text-sm mt-4">
          {lastUpset.winnerName} moved up {lastUpset.spotsGained} {lastUpset.spotsGained === 1 ? 'spot' : 'spots'}
        </div>
      )}
    </div>
  )
}
