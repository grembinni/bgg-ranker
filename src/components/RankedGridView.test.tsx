// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockReorderRankedList = vi.fn()

function buildRatings(count: number) {
  const ratings: Record<string, number> = {}
  for (let i = 0; i < count; i++) {
    ratings[`g${i}`] = 900 - i
  }
  return ratings
}

function buildGames(count: number) {
  const games: Record<string, { id: string; name: string; yearPublished: number; thumbnail: string }> = {}
  for (let i = 0; i < count; i++) {
    games[`g${i}`] = { id: `g${i}`, name: `Game ${i}`, yearPublished: 2020, thumbnail: '' }
  }
  return games
}

let mockRatings: Record<string, number> = buildRatings(2)
let mockGames: Record<string, unknown> = buildGames(2)

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      ratings: mockRatings,
      games: mockGames,
      reorderRankedList: mockReorderRankedList,
    }),
}))

import RankedGridView from './RankedGridView'

beforeEach(() => {
  vi.clearAllMocks()
  mockRatings = buildRatings(2)
  mockGames = buildGames(2)
})

describe('RankedGridView back button removal (D-05)', () => {
  it('does not render a header element', () => {
    render(<RankedGridView />)
    expect(document.querySelector('header')).not.toBeInTheDocument()
  })

  it('does not render a "Back" control', () => {
    render(<RankedGridView />)
    expect(screen.queryByText(/back/i)).not.toBeInTheDocument()
  })
})

describe('RankedGridView pagination side click-zones stacking (CR-02 regression)', () => {
  it('renders no side click-zones when there is only one page (no z-index concerns)', () => {
    mockRatings = buildRatings(5)
    mockGames = buildGames(5)
    render(<RankedGridView />)
    // No zones expected for a single small page
    expect(document.querySelector('.z-10')).not.toBeInTheDocument()
  })

  it('right side click-zone carries z-10 class when more pages remain', () => {
    mockRatings = buildRatings(250)
    mockGames = buildGames(250)
    render(<RankedGridView />)
    const zone = document.querySelector('.z-10')
    expect(zone).toBeInTheDocument()
    expect(zone).toHaveClass('z-10')
    expect(zone).toHaveClass('fixed')
  })

  it('left side click-zone carries z-10 class when offset > 0', () => {
    mockRatings = buildRatings(250)
    mockGames = buildGames(250)
    render(<RankedGridView />)
    // Click "Next 100" to move offset > 0
    screen.getByRole('button', { name: /next 100/i }).click()
    const zones = document.querySelectorAll('.z-10')
    expect(zones.length).toBeGreaterThanOrEqual(1)
    zones.forEach(zone => {
      expect(zone).toHaveClass('z-10')
      expect(zone).toHaveClass('fixed')
    })
  })
})
