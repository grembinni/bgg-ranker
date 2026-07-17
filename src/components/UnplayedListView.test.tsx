// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockMoveUnplayedToRanked = vi.fn()

let mockUnplayedIds: string[] = []
let mockRatings: Record<string, number> = {}
let mockGames: Record<string, unknown> = {}

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      unplayedIds: mockUnplayedIds,
      ratings: mockRatings,
      games: mockGames,
      moveUnplayedToRanked: mockMoveUnplayedToRanked,
    }),
}))

import UnplayedListView from './UnplayedListView'

beforeEach(() => {
  vi.clearAllMocks()
  mockUnplayedIds = []
  mockRatings = {}
  mockGames = {}
})

describe('UnplayedListView back button removal (D-05)', () => {
  it('does not render a header element', () => {
    mockUnplayedIds = ['g0']
    mockGames = { g0: { id: 'g0', name: 'Game A', yearPublished: 2020, thumbnail: '' } }
    render(<UnplayedListView />)
    expect(document.querySelector('header')).not.toBeInTheDocument()
  })

  it('does not render a "← Back" control', () => {
    mockUnplayedIds = ['g0']
    mockGames = { g0: { id: 'g0', name: 'Game A', yearPublished: 2020, thumbnail: '' } }
    render(<UnplayedListView />)
    expect(screen.queryByText(/← Back/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })
})

describe('UnplayedListView smoke coverage', () => {
  it('renders empty state message when no unplayed games', () => {
    mockUnplayedIds = []
    render(<UnplayedListView />)
    expect(screen.getByText('No games marked as unplayed yet.')).toBeInTheDocument()
  })

  it('renders rows for a populated unplayed list', () => {
    mockUnplayedIds = ['g0', 'g1']
    mockRatings = { g9: 900 }
    mockGames = {
      g0: { id: 'g0', name: 'Game A', yearPublished: 2020, thumbnail: '' },
      g1: { id: 'g1', name: 'Game B', yearPublished: 2021, thumbnail: '' },
    }
    render(<UnplayedListView />)
    expect(screen.getByText('Game A')).toBeInTheDocument()
    expect(screen.getByText('Game B')).toBeInTheDocument()
  })
})
