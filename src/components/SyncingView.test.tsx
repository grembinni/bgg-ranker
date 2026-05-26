// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockCancelSync = vi.fn()
const mockReAuthAndResume = vi.fn()
const mockStartSync = vi.fn()

let mockSyncStatus: 'idle' | 'syncing' | 'session-expired' | 'error' | 'complete' = 'syncing'
let mockSyncProgress = 0
let mockSyncTotal = 0
let mockSyncErrorDetail: string | null = null
let mockSyncSkippedGames: string[] = []

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      syncStatus: mockSyncStatus,
      syncProgress: mockSyncProgress,
      syncTotal: mockSyncTotal,
      syncErrorDetail: mockSyncErrorDetail,
      syncSkippedGames: mockSyncSkippedGames,
      cancelSync: mockCancelSync,
      reAuthAndResume: mockReAuthAndResume,
      startSync: mockStartSync,
    }),
}))

import SyncingView from './SyncingView'

beforeEach(() => {
  vi.clearAllMocks()
  mockSyncStatus = 'syncing'
  mockSyncProgress = 0
  mockSyncTotal = 0
  mockSyncErrorDetail = null
  mockSyncSkippedGames = []
})

describe('SyncingView — syncStatus syncing (SYNC-01, SYNC-02)', () => {
  it('renders "Syncing N / total…" with current progress and total (SYNC-02)', () => {
    mockSyncProgress = 3
    mockSyncTotal = 10
    mockSyncStatus = 'syncing'

    render(<SyncingView />)

    expect(screen.getByText(/Syncing 3 \/ 10/i)).toBeInTheDocument()
  })

  it('renders a Cancel button in syncing state', () => {
    mockSyncStatus = 'syncing'
    render(<SyncingView />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('Cancel button calls cancelSync() on click', () => {
    mockSyncStatus = 'syncing'
    render(<SyncingView />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockCancelSync).toHaveBeenCalledTimes(1)
  })
})

describe('SyncingView — syncStatus session-expired (AUTH-03, D-09)', () => {
  beforeEach(() => {
    mockSyncStatus = 'session-expired'
    mockSyncProgress = 5
    mockSyncTotal = 12
  })

  it('shows paused progress label with progress/total counts (SYNC-03)', () => {
    render(<SyncingView />)
    expect(screen.getByText(/5 \/ 12/i)).toBeInTheDocument()
  })

  it('shows "Session expired" copy with re-auth instruction (D-09)', () => {
    render(<SyncingView />)
    expect(screen.getByText(/session expired/i)).toBeInTheDocument()
  })

  it('renders a password input (local state only — never persisted)', () => {
    render(<SyncingView />)
    const input = screen.getByLabelText(/password/i) as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('password')
  })

  it('renders "Resume Sync" button', () => {
    render(<SyncingView />)
    expect(screen.getByRole('button', { name: /resume sync/i })).toBeInTheDocument()
  })

  it('Resume Sync button calls reAuthAndResume with typed password', () => {
    render(<SyncingView />)
    const input = screen.getByLabelText(/password/i)
    fireEvent.change(input, { target: { value: 'newpass123' } })
    fireEvent.click(screen.getByRole('button', { name: /resume sync/i }))
    expect(mockReAuthAndResume).toHaveBeenCalledWith('newpass123')
  })

  it('Cancel button calls cancelSync() in session-expired state', () => {
    render(<SyncingView />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockCancelSync).toHaveBeenCalledTimes(1)
  })
})

describe('SyncingView — syncStatus error', () => {
  beforeEach(() => {
    mockSyncStatus = 'error'
  })

  it('shows error message text', () => {
    render(<SyncingView />)
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument()
  })

  it('shows a "Try again" button that calls startSync()', () => {
    render(<SyncingView />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(mockStartSync).toHaveBeenCalledTimes(1)
  })

  it('shows a Cancel button that calls cancelSync()', () => {
    render(<SyncingView />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockCancelSync).toHaveBeenCalledTimes(1)
  })

  it('shows syncErrorDetail when present', () => {
    mockSyncErrorDetail = 'HTTP 403'
    render(<SyncingView />)
    expect(screen.getByText(/HTTP 403/)).toBeInTheDocument()
  })

  it('shows no error detail when syncErrorDetail is null', () => {
    mockSyncErrorDetail = null
    render(<SyncingView />)
    expect(screen.queryByText(/HTTP/)).not.toBeInTheDocument()
  })
})

describe('SyncingView — syncStatus complete (D-07, SYNC-01)', () => {
  it('shows "Sync complete — N games updated" in green text', () => {
    mockSyncStatus = 'complete'
    mockSyncProgress = 7
    render(<SyncingView />)
    expect(screen.getByText(/sync complete/i)).toBeInTheDocument()
    expect(screen.getByText(/7 games updated/i)).toBeInTheDocument()
  })

  it('shows skipped game names on complete when some games returned 400', () => {
    mockSyncStatus = 'complete'
    mockSyncProgress = 3
    mockSyncSkippedGames = ['Wingspan', 'Gloomhaven']
    render(<SyncingView />)
    expect(screen.getByText(/Error syncing Wingspan/i)).toBeInTheDocument()
    expect(screen.getByText(/Error syncing Gloomhaven/i)).toBeInTheDocument()
    expect(screen.getByText(/1 games updated/i)).toBeInTheDocument()
  })
})

describe('SyncingView — skipped games during sync', () => {
  it('shows skipped game error inline while still syncing', () => {
    mockSyncStatus = 'syncing'
    mockSyncProgress = 5
    mockSyncTotal = 10
    mockSyncSkippedGames = ['Pandemic']
    render(<SyncingView />)
    expect(screen.getByText(/Error syncing Pandemic/i)).toBeInTheDocument()
  })
})
