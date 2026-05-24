import { useStore } from '../store/store'
import GameCard from './GameCard'

export default function ComparisonView() {
  const currentPair = useStore(s => s.currentPair)
  const sessionComparisons = useStore(s => s.sessionComparisons)
  const comparisonsTotal = useStore(s => s.comparisonsTotal)
  const sessionUsername = useStore(s => s.sessionUsername)
  const pick = useStore(s => s.pick)
  const skip = useStore(s => s.skip)
  const refresh = useStore(s => s.refresh)

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
        <span>{sessionUsername}</span>
        <span>{sessionComparisons} this session · {comparisonsTotal} total</span>
      </header>
      <div className="grid grid-cols-2 gap-6">
        <GameCard gameId={leftId} onPick={() => pick(leftId, rightId)} />
        <GameCard gameId={rightId} onPick={() => pick(rightId, leftId)} />
      </div>
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
          onClick={refresh}
          className="px-6 py-2 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
