import { useStore } from '../store/store'

export default function CollectionLoading() {
  const loadingMessage = useStore((s) => s.loadingMessage)

  return (
    <div className="max-w-sm mx-auto px-4 py-12 text-center" role="status" aria-live="polite">
      <h2 className="text-xl font-semibold leading-tight text-gray-900">Loading collection…</h2>
      <p className="text-base font-normal leading-normal text-gray-700 mt-4">
        Fetching your games from BGG. This may take a moment.
      </p>
      <div
        className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mt-8"
        aria-hidden="true"
      />
      <span className="sr-only">Loading…</span>
      {loadingMessage && (
        <p className="text-base font-normal leading-normal text-gray-700 mt-4">{loadingMessage}</p>
      )}
    </div>
  )
}
