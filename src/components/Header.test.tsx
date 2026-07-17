// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockStartSync = vi.fn()
const mockRefresh = vi.fn()
const mockShowRankedList = vi.fn()
const mockShowRankedGrid = vi.fn()
const mockShowUnplayedList = vi.fn()
const mockBackToComparison = vi.fn()
const mockLogout = vi.fn()

let mockDirtyGameIds: string[] = ['g0']
let mockSessionId: string | null = 'test-session-id'
let mockUnplayedIds: string[] = ['g5', 'g6']
let mockView: string = 'comparison'

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      sessionComparisons: 3,
      comparisonsTotal: 5,
      sessionUsername: 'alice',
      sessionId: mockSessionId,
      dirtyGameIds: mockDirtyGameIds,
      unplayedIds: mockUnplayedIds,
      refresh: mockRefresh,
      startSync: mockStartSync,
      showRankedList: mockShowRankedList,
      showRankedGrid: mockShowRankedGrid,
      showUnplayedList: mockShowUnplayedList,
      backToComparison: mockBackToComparison,
      logout: mockLogout,
      view: mockView,
    }),
}))

import Header from './Header'

beforeEach(() => {
  vi.clearAllMocks()
  mockDirtyGameIds = ['g0']
  mockSessionId = 'test-session-id'
  mockUnplayedIds = ['g5', 'g6']
  mockView = 'comparison'
})

describe('Header hamburger menu', () => {
  it('renders a hamburger button with aria-label "Menu"', () => {
    render(<Header />)
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })

  it('dropdown items are NOT visible initially', () => {
    render(<Header />)
    expect(screen.queryByRole('button', { name: /refresh rankings/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^unplayed/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument()
  })

  it('clicking hamburger reveals Sync to BGG, Refresh rankings, Unplayed, and Logout items', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /sync to bgg \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh rankings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unplayed \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  it('"Sync to BGG" item is disabled when dirtyGameIds is empty', () => {
    mockDirtyGameIds = []
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /sync to bgg/i })).toBeDisabled()
  })

  it('"Sync to BGG" item is disabled when sessionId is null', () => {
    mockSessionId = null
    mockDirtyGameIds = ['g0']
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /sync to bgg/i })).toBeDisabled()
  })

  it('"Sync to BGG" item is enabled when dirtyGameIds is non-empty and sessionId present', () => {
    mockDirtyGameIds = ['g0', 'g1']
    mockSessionId = 'test-session-id'
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /sync to bgg/i })).not.toBeDisabled()
  })

  it('clicking Sync calls startSync()', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /sync to bgg/i }))
    expect(mockStartSync).toHaveBeenCalledTimes(1)
  })

  it('clicking Refresh calls refresh()', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /refresh rankings/i }))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('clicking Unplayed calls showUnplayedList()', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /unplayed \(2\)/i }))
    expect(mockShowUnplayedList).toHaveBeenCalledTimes(1)
  })

  it('clicking Logout calls logout()', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })
})

describe('Header session counts and username', () => {
  it('renders session-count text', () => {
    render(<Header />)
    expect(screen.getByText('3 this session · 5 total')).toBeInTheDocument()
  })

  it('renders username', () => {
    render(<Header />)
    expect(screen.getByText('alice')).toBeInTheDocument()
  })
})

describe('Header view-switch icons', () => {
  it('renders three view-switch buttons with correct aria-labels', () => {
    render(<Header />)
    expect(screen.getByRole('button', { name: 'Comparison view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ranked list view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grid view' })).toBeInTheDocument()
  })

  it('renders the correct glyphs for each view-switch button', () => {
    render(<Header />)
    expect(screen.getByRole('button', { name: 'Comparison view' })).toHaveTextContent('⚔')
    expect(screen.getByRole('button', { name: 'Ranked list view' })).toHaveTextContent('☰')
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveTextContent('⊞')
  })

  it('clicking the vs icon calls backToComparison()', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'Comparison view' }))
    expect(mockBackToComparison).toHaveBeenCalledTimes(1)
  })

  it('clicking the list icon calls showRankedList()', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'Ranked list view' }))
    expect(mockShowRankedList).toHaveBeenCalledTimes(1)
  })

  it('clicking the grid icon calls showRankedGrid()', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }))
    expect(mockShowRankedGrid).toHaveBeenCalledTimes(1)
  })

  it('highlights the grid icon as active when view is ranked-grid', () => {
    mockView = 'ranked-grid'
    render(<Header />)
    const gridBtn = screen.getByRole('button', { name: 'Grid view' })
    const listBtn = screen.getByRole('button', { name: 'Ranked list view' })
    const vsBtn = screen.getByRole('button', { name: 'Comparison view' })
    expect(gridBtn.className).toMatch(/text-blue-600/)
    expect(gridBtn.className).toMatch(/bg-blue-50/)
    expect(listBtn.className).not.toMatch(/text-blue-600/)
    expect(vsBtn.className).not.toMatch(/text-blue-600/)
  })

  it('highlights the comparison icon as active when view is comparison', () => {
    mockView = 'comparison'
    render(<Header />)
    const vsBtn = screen.getByRole('button', { name: 'Comparison view' })
    expect(vsBtn.className).toMatch(/text-blue-600/)
    expect(vsBtn.className).toMatch(/bg-blue-50/)
  })

  it('highlights the list icon as active when view is ranked-list', () => {
    mockView = 'ranked-list'
    render(<Header />)
    const listBtn = screen.getByRole('button', { name: 'Ranked list view' })
    expect(listBtn.className).toMatch(/text-blue-600/)
    expect(listBtn.className).toMatch(/bg-blue-50/)
  })
})
