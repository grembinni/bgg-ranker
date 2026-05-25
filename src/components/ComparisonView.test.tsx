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
 * Phase 4 additions: DISP-01 (thumbnail), DISP-02 (upset callout), D-08/D-09 (hamburger)
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
const mockLogout = vi.fn()

let mockDirtyGameIds: string[] = ['g0']
let mockSessionId: string | null = 'test-session-id'
let mockLastUpset: null | { winnerName: string; spotsGained: number } = null
let mockCurrentPair: [string, string] = ['g0', 'g1']

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      currentPair: mockCurrentPair,
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
      logout: mockLogout,
      lastUpset: mockLastUpset,
      games: {
        g0: { id: 'g0', name: 'Game A', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', name: 'Game B', yearPublished: 2021, thumbnail: '' },
        g2: { id: 'g2', name: 'Game C', yearPublished: 2022, thumbnail: 'https://example.com/thumb.jpg' },
      },
      ratings: { g0: 900, g1: 700, g2: 500 },
    }),
}))

import ComparisonView from './ComparisonView'

beforeEach(() => {
  vi.clearAllMocks()
  mockDirtyGameIds = ['g0']
  mockSessionId = 'test-session-id'
  mockLastUpset = null
  mockCurrentPair = ['g0', 'g1']
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

// ---------------------------------------------------------------------------
// GameCard thumbnail (DISP-01)
// ---------------------------------------------------------------------------

describe('GameCard thumbnail (DISP-01)', () => {
  it('renders an img element when thumbnail URL exists', () => {
    mockCurrentPair = ['g2', 'g1']
    render(<ComparisonView />)
    // g2 has a thumbnail URL — expect an img to be present
    const imgs = screen.getAllByRole('img')
    expect(imgs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders placeholder div with "No image" text when thumbnail is empty string', () => {
    // g0 and g1 both have thumbnail: '' — placeholder should render
    mockCurrentPair = ['g0', 'g1']
    render(<ComparisonView />)
    const noImageTexts = screen.getAllByText(/no image/i)
    expect(noImageTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('wraps img in a link to boardgamegeek.com/boardgame/{id} when thumbnail URL exists', () => {
    mockCurrentPair = ['g2', 'g1']
    render(<ComparisonView />)
    const link = screen.getByRole('link', { name: /game c/i })
    expect(link).toHaveAttribute('href', 'https://boardgamegeek.com/boardgame/g2')
  })
})

// ---------------------------------------------------------------------------
// Upset callout (DISP-02)
// ---------------------------------------------------------------------------

describe('Upset callout (DISP-02)', () => {
  it('renders nothing when lastUpset is null', () => {
    mockLastUpset = null
    render(<ComparisonView />)
    expect(screen.queryByText(/moved up/i)).not.toBeInTheDocument()
  })

  it('renders callout text with plural "spots" when spotsGained > 1', () => {
    mockLastUpset = { winnerName: 'Game A', spotsGained: 3 }
    render(<ComparisonView />)
    expect(screen.getByText(/Game A moved up 3 spots/i)).toBeInTheDocument()
  })

  it('renders callout text with singular "spot" when spotsGained === 1', () => {
    mockLastUpset = { winnerName: 'Game A', spotsGained: 1 }
    render(<ComparisonView />)
    expect(screen.getByText(/Game A moved up 1 spot/i)).toBeInTheDocument()
  })

  it('callout container has amber styling (bg-amber-50)', () => {
    mockLastUpset = { winnerName: 'Game A', spotsGained: 3 }
    render(<ComparisonView />)
    const callout = screen.getByText(/Game A moved up 3 spots/i)
    expect(callout.className).toMatch(/bg-amber-50/)
  })
})

// ---------------------------------------------------------------------------
// Hamburger menu (D-08, D-09)
// ---------------------------------------------------------------------------

describe('Hamburger menu (D-08, D-09)', () => {
  it('renders a hamburger button with aria-label "Menu" in the header', () => {
    render(<ComparisonView />)
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })

  it('dropdown items are NOT visible initially', () => {
    render(<ComparisonView />)
    expect(screen.queryByRole('button', { name: /refresh rankings/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument()
  })

  it('clicking hamburger button reveals Sync to BGG, Refresh rankings, and Logout items', () => {
    render(<ComparisonView />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /sync to bgg/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh rankings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  it('"Sync to BGG" item in dropdown is disabled when dirtyGameIds is empty', () => {
    mockDirtyGameIds = []
    render(<ComparisonView />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    const syncBtn = screen.getByRole('button', { name: /sync to bgg/i })
    expect(syncBtn).toBeDisabled()
  })

  it('clicking "Logout" calls logout() from store', () => {
    render(<ComparisonView />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('clicking "Refresh rankings" calls refresh() from store', () => {
    render(<ComparisonView />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /refresh rankings/i }))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('standalone Refresh button is NOT in the action bar (Refresh is menu-only)', () => {
    render(<ComparisonView />)
    // The only Refresh button should be inside the hamburger dropdown (not visible yet)
    // Before opening the menu, there should be no button with text "Refresh" or "Refresh rankings"
    const refreshBtns = screen.queryAllByRole('button', { name: /^refresh$/i })
    expect(refreshBtns.length).toBe(0)
  })
})
