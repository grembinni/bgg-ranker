// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockLogin = vi.fn()

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ login: mockLogin }),
}))

import UsernameEntry from './UsernameEntry'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UsernameEntry form validation and submission (AUTH-01)', () => {
  it('shows "Password is required." when submitted with empty password (AUTH-01)', () => {
    render(<UsernameEntry />)
    fireEvent.change(screen.getByLabelText(/bgg username/i), { target: { value: 'myuser' } })
    fireEvent.click(screen.getByRole('button', { name: /load collection/i }))
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('shows "Username is required." when submitted with empty username (AUTH-01)', () => {
    render(<UsernameEntry />)
    fireEvent.change(screen.getByLabelText(/bgg password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /load collection/i }))
    expect(screen.getByText('Username is required.')).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('calls store.login(username, password) when both fields are filled (AUTH-01)', () => {
    render(<UsernameEntry />)
    fireEvent.change(screen.getByLabelText(/bgg username/i), { target: { value: 'myuser' } })
    fireEvent.change(screen.getByLabelText(/bgg password/i), { target: { value: 'mypass' } })
    fireEvent.click(screen.getByRole('button', { name: /load collection/i }))
    expect(mockLogin).toHaveBeenCalledWith('myuser', 'mypass')
    expect(mockLogin).toHaveBeenCalledTimes(1)
  })
})
