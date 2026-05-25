// @vitest-environment jsdom

/**
 * ComparisonView.test.tsx — Unit tests for ComparisonView Sync button (03-04)
 *
 * Tests the "Sync to BGG" button added to the ComparisonView header:
 *   - Button is always visible (never hidden)
 *   - Button is disabled when dirtyGameIds.length === 0 (D-08)
 *   - Button is enabled when dirtyGameIds.length > 0
 *   - Button calls startSync() on click when enabled
 *
 * Covers requirements: SYNC-01, SYNC-02
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// Mock the Zustand store
// ---------------------------------------------------------------------------

const mockStartSync = vi.fn()
const mockPick = vi.fn()
const mockSkip = vi.fn()
const mockRefresh = vi.fn()
const mockMarkUnplayed = vi.fn()
const mockShowRankedList = vi.fn()
const mockShowUnplayedList = vi.fn()

let mockDirtyGameIds: string[] = ['g0']
let mockSessionId: string | null = 'test-session-id'

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      currentPair: ['g0', 'g1'],
      sessionComparisons: 3,
      comparisonsTotal: 5,
      sessionUsername: 'alice',
      sessionId: mockSessionId,
      dirtyGameIds: mockDirtyGameIds,
      unplayedIds: [],
      startSync: mockStartSync,
      pick: mockPick,
      skip: mockSkip,
      refresh: mockRefresh,
      markUnplayed: mockMarkUnplayed,
      showRankedList: mockShowRankedList,
      showUnplayedList: mockShowUnplayedList,
      games: {
        g0: { id: 'g0', name: 'Game A', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', name: 'Game B', yearPublished: 2021, thumbnail: '' },
      },
      ratings: { g0: 900, g1: 700 },
    }),
}))

import ComparisonView from './ComparisonView'

beforeEach(() => {
  vi.clearAllMocks()
  mockDirtyGameIds = ['g0']
  mockSessionId = 'test-session-id'
})

// ---------------------------------------------------------------------------
// Sync to BGG button — always visible
// ---------------------------------------------------------------------------

describe('ComparisonView Sync to BGG button (SYNC-01, SYNC-02, D-05, D-08)', () => {
  it('renders "Sync to BGG" button in the header', () => {
    render(<ComparisonView />)
    expect(screen.getByRole('button', { name: /sync to bgg/i })).toBeInTheDocument()
  })

  it('Sync to BGG button is always rendered regardless of disabled state', () => {
    mockDirtyGameIds = [] // would be disabled
    render(<ComparisonView />)
    expect(screen.getByRole('button', { name: /sync to bgg/i })).toBeInTheDocument()
  })

  it('Sync to BGG button is enabled when dirtyGameIds is non-empty (D-08)', () => {
    mockDirtyGameIds = ['g0', 'g1']
    render(<ComparisonView />)
    const btn = screen.getByRole('button', { name: /sync to bgg/i })
    expect(btn).not.toBeDisabled()
  })

  it('Sync to BGG button is disabled when dirtyGameIds is empty (D-08)', () => {
    mockDirtyGameIds = []
    render(<ComparisonView />)
    const btn = screen.getByRole('button', { name: /sync to bgg/i })
    expect(btn).toBeDisabled()
  })

  it('Sync to BGG button is disabled when sessionId is null (D-04 — no auth on return visit)', () => {
    mockSessionId = null
    mockDirtyGameIds = ['g0']
    render(<ComparisonView />)
    const btn = screen.getByRole('button', { name: /sync to bgg/i })
    expect(btn).toBeDisabled()
  })

  it('clicking Sync to BGG button calls startSync() (SYNC-01)', () => {
    mockDirtyGameIds = ['g0']
    render(<ComparisonView />)
    fireEvent.click(screen.getByRole('button', { name: /sync to bgg/i }))
    expect(mockStartSync).toHaveBeenCalledTimes(1)
  })
})
