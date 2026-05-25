import { useState } from 'react'
import { useStore } from '../store/store'

export default function UsernameEntry() {
  const [input, setInput] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [password, setPassword] = useState<string>('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const login = useStore((s) => s.login)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = input.trim()
    const trimmedPassword = password.trim()

    let hasError = false

    if (trimmed === '') {
      setValidationError('Username is required.')
      hasError = true
    } else {
      setValidationError(null)
    }

    if (trimmedPassword === '') {
      setPasswordError('Password is required.')
      hasError = true
    } else {
      setPasswordError(null)
    }

    if (hasError) return

    login(trimmed, trimmedPassword)
  }

  const inputClasses =
    'w-full border border-gray-200 rounded px-3 py-2 text-base' +
    (validationError !== null ? ' border-red-400' : '')

  const passwordInputClasses =
    'w-full border border-gray-200 rounded px-3 py-2 text-base' +
    (passwordError !== null ? ' border-red-400' : '')

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold leading-tight text-gray-900">BGG Ranker</h1>
      <p className="text-base font-normal leading-normal text-gray-700 mt-2">
        Enter your BGG username and password to load your collection and enable sync.
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label htmlFor="bgg-username" className="text-sm font-normal leading-snug text-gray-700">
          BGG Username
        </label>
        <input
          id="bgg-username"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={inputClasses}
        />
        {validationError !== null && (
          <p className="text-sm text-red-600">{validationError}</p>
        )}
        <label htmlFor="bgg-password" className="text-sm font-normal leading-snug text-gray-700">
          BGG Password
        </label>
        <input
          id="bgg-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={passwordInputClasses}
        />
        {passwordError !== null && (
          <p className="text-sm text-red-600">{passwordError}</p>
        )}
        <button
          type="submit"
          className="min-h-[44px] bg-blue-600 text-white text-base font-semibold rounded px-4 py-2 hover:bg-blue-700 active:bg-blue-800 outline-2 outline-offset-2 outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Load Collection
        </button>
      </form>

    </div>
  )
}
