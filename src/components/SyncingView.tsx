import { useState } from 'react'
import { useStore } from '../store/store'

export default function SyncingView() {
  const syncStatus = useStore((s) => s.syncStatus)
  const syncProgress = useStore((s) => s.syncProgress)
  const syncTotal = useStore((s) => s.syncTotal)
  const cancelSync = useStore((s) => s.cancelSync)
  const startSync = useStore((s) => s.startSync)
  const reAuthAndResume = useStore((s) => s.reAuthAndResume)
  const syncErrorDetail = useStore((s) => s.syncErrorDetail)
  const syncSkippedGames = useStore((s) => s.syncSkippedGames)

  // password kept in local state only — never written to Zustand or localStorage
  const [reAuthPassword, setReAuthPassword] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleResume = async () => {
    if (!reAuthPassword || isSubmitting) return
    setIsSubmitting(true)
    try {
      await reAuthAndResume(reAuthPassword)
    } finally {
      setIsSubmitting(false)
    }
  }

  const container = 'max-w-sm mx-auto px-4 py-12'

  if (syncStatus === 'complete') {
    return (
      <div className={container}>
        <p className="text-xl font-semibold text-green-600 text-center">
          Sync complete — {syncProgress - syncSkippedGames.length} games updated
        </p>
        {syncSkippedGames.length > 0 && (
          <ul className="mt-4 space-y-1">
            {syncSkippedGames.map((name) => (
              <li key={name} className="text-sm text-red-500">
                Error syncing {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (syncStatus === 'session-expired') {
    return (
      <div className={container}>
        <p className="text-base text-gray-700 mb-4 text-center">
          Syncing paused ({syncProgress} / {syncTotal} complete)
        </p>
        <div className="border border-amber-200 rounded-lg p-4 bg-white">
          <p className="text-base text-gray-900 mb-3">
            Session expired — re-enter your BGG password to continue.
          </p>
          <label htmlFor="reauth-password" className="block text-sm text-gray-700 mb-1">
            BGG Password
          </label>
          <input
            id="reauth-password"
            type="password"
            value={reAuthPassword}
            onChange={(e) => setReAuthPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-900 outline-2 outline-offset-2 outline-blue-600 mb-3"
            autoComplete="current-password"
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isSubmitting || !reAuthPassword}
              onClick={handleResume}
              className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Resuming…' : 'Resume Sync'}
            </button>
            <button
              type="button"
              onClick={cancelSync}
              className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (syncStatus === 'error') {
    return (
      <div className={container}>
        <div className="border border-red-200 rounded-lg p-4 bg-white" role="alert">
          <p className="text-base text-red-600 mb-3">
            Sync failed. Please try again.
            {syncErrorDetail && (
              <span className="block text-xs text-red-400 mt-1 font-mono break-all">{syncErrorDetail}</span>
            )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => startSync()}
              className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={cancelSync}
              className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={container}>
      <p className="text-xl font-semibold text-gray-900 text-center mb-6">
        Syncing {syncProgress} / {syncTotal}…
      </p>
      {syncSkippedGames.length > 0 && (
        <ul className="mb-4 space-y-1">
          {syncSkippedGames.map((name) => (
            <li key={name} className="text-sm text-red-500">
              Error syncing {name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={cancelSync}
          className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
