import { useStore } from '../store/store'

export default function ErrorDisplay() {
  const errorMessage = useStore((s) => s.errorMessage)
  const resetForNewUser = useStore((s) => s.resetForNewUser)

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <div className="border border-red-200 rounded-lg p-4 bg-white" role="alert">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-base text-red-600">{errorMessage ?? 'An unknown error occurred.'}</p>
        <button
          type="button"
          onClick={resetForNewUser}
          className="mt-4 px-6 py-2 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 outline-2 outline-offset-2 outline-blue-600"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
