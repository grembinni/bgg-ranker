import { useState } from 'react'
import { useStore } from '../store/store'

/**
 * SyncingView — Dedicated sync progress view (D-06).
 *
 * Renders based on syncStatus from the store:
 *   'syncing'         — live progress counter + Cancel button (SYNC-02)
 *   'session-expired' — paused progress + inline re-auth form (D-09, T-03-09)
 *   'error'           — error message + Cancel/Return button
 *   'complete'        — success message (D-07; store auto-returns after 2000ms)
 *
 * T-03-09: reAuthPassword is local React state — never written to Zustand or localStorage.
 * Component never calls bggClient directly (CLAUDE.md).
 */
export default function SyncingView() {
  const syncStatus = useStore((s) => s.syncStatus)
  const syncProgress = useStore((s) => s.syncProgress)
  const syncTotal = useStore((s) => s.syncTotal)
  const cancelSync = useStore((s) => s.cancelSync)
  const reAuthAndResume = useStore((s) => s.reAuthAndResume)

  // T-03-09: password kept in local state only — cleared on unmount; never persisted
  const [reAuthPassword, setReAuthPassword] = useState<string>('')
  // WR-04: prevent double-submission while re-auth is in flight
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

  // Shared layout: centered, max-w-sm, matching UsernameEntry proportions
  const container = 'max-w-sm mx-auto px-4 py-12'

  if (syncStatus === 'complete') {
    return (
      <div className={container}>
        <p className="text-xl font-semibold text-green-600 text-center">
          Sync complete — {syncProgress} games updated
        </p>
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
          <p className="text-base text-red-600 mb-3">Sync failed. Please try again.</p>
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

  // Default: syncStatus === 'syncing'
  return (
    <div className={container}>
      <p className="text-xl font-semibold text-gray-900 text-center mb-6">
        Syncing {syncProgress} / {syncTotal}…
      </p>
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
