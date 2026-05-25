/**
 * SyncingView.test.tsx — Unit tests for the SyncingView component
 *
 * Tests the rendered output for each syncStatus value:
 *   'syncing'         — shows progress counter and Cancel button
 *   'session-expired' — shows inline re-auth form with Resume Sync + Cancel
 *   'error'           — shows error message and Cancel/Return button
 *   'complete'        — shows success message
 *
 * Store is mocked via vi.mock so these tests run in the Vitest node environment
 * without requiring a real Zustand store or DOM.
 *
 * Covers requirements: SYNC-01, SYNC-02, SYNC-03, AUTH-03 (T-03-09)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// Mock the Zustand store — inject controlled state per test
// ---------------------------------------------------------------------------

const mockCancelSync = vi.fn()
const mockReAuthAndResume = vi.fn()

let mockSyncStatus: 'idle' | 'syncing' | 'session-expired' | 'error' | 'complete' = 'syncing'
let mockSyncProgress = 0
let mockSyncTotal = 0

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      syncStatus: mockSyncStatus,
      syncProgress: mockSyncProgress,
      syncTotal: mockSyncTotal,
      cancelSync: mockCancelSync,
      reAuthAndResume: mockReAuthAndResume,
    }),
}))

import SyncingView from './SyncingView'

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockSyncStatus = 'syncing'
  mockSyncProgress = 0
  mockSyncTotal = 0
})

// ---------------------------------------------------------------------------
// syncStatus === 'syncing'
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// syncStatus === 'session-expired'
// ---------------------------------------------------------------------------

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

  it('renders a password input (T-03-09 — local state, not Zustand)', () => {
    render(<SyncingView />)
    const input = screen.getByLabelText(/password/i) as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('password')
  })

  it('renders "Resume Sync" button (D-10)', () => {
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

// ---------------------------------------------------------------------------
// syncStatus === 'error'
// ---------------------------------------------------------------------------

describe('SyncingView — syncStatus error', () => {
  beforeEach(() => {
    mockSyncStatus = 'error'
  })

  it('shows error message text', () => {
    render(<SyncingView />)
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument()
  })

  it('shows a Cancel/Return button that calls cancelSync()', () => {
    render(<SyncingView />)
    const btn = screen.getByRole('button', { name: /cancel|return/i })
    fireEvent.click(btn)
    expect(mockCancelSync).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// syncStatus === 'complete'
// ---------------------------------------------------------------------------

describe('SyncingView — syncStatus complete (D-07, SYNC-01)', () => {
  it('shows "Sync complete — N games updated" in green text', () => {
    mockSyncStatus = 'complete'
    mockSyncProgress = 7
    render(<SyncingView />)
    expect(screen.getByText(/sync complete/i)).toBeInTheDocument()
    expect(screen.getByText(/7 games updated/i)).toBeInTheDocument()
  })
})
