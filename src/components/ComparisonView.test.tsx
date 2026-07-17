// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockPick = vi.fn()
const mockSkip = vi.fn()
const mockMarkUnplayed = vi.fn()

let mockLastUpset: null | { winnerName: string; spotsGained: number } = null
let mockCurrentPair: [string, string] = ['g0', 'g1']

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      currentPair: mockCurrentPair,
      pick: mockPick,
      skip: mockSkip,
      markUnplayed: mockMarkUnplayed,
      lastUpset: mockLastUpset,
      games: {
        g0: { id: 'g0', name: 'Game A', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', name: 'Game B', yearPublished: 2021, thumbnail: '' },
        g2: { id: 'g2', name: 'Game C', yearPublished: 2022, thumbnail: 'https://example.com/thumb.jpg' },
      },
      ratings: { g0: 900, g1: 700, g2: 500 },
      lastSyncedRatings: {},
    }),
}))

import ComparisonView from './ComparisonView'

beforeEach(() => {
  vi.clearAllMocks()
  mockLastUpset = null
  mockCurrentPair = ['g0', 'g1']
})

describe('GameCard thumbnail (DISP-01)', () => {
  it('renders an img element when thumbnail URL exists', () => {
    mockCurrentPair = ['g2', 'g1']
    render(<ComparisonView />)
    const imgs = screen.getAllByRole('img')
    expect(imgs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders placeholder div with "No image" text when thumbnail is empty string', () => {
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

describe('Skip button + nav cleanup (D-06, D-07, D-08)', () => {
  it('renders a Skip button and clicking it calls skip()', () => {
    render(<ComparisonView />)
    const skipBtn = screen.getByRole('button', { name: 'Skip' })
    fireEvent.click(skipBtn)
    expect(mockSkip).toHaveBeenCalledTimes(1)
  })

  it('Skip button has red full-height styling (D-08)', () => {
    render(<ComparisonView />)
    const skipBtn = screen.getByRole('button', { name: 'Skip' })
    expect(skipBtn.className).toMatch(/bg-red-500/)
    expect(skipBtn.className).toMatch(/h-full/)
  })

  it('does not render Ranked list, Grid view, or Unplayed nav buttons (moved to header)', () => {
    render(<ComparisonView />)
    expect(screen.queryByRole('button', { name: /ranked list/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /grid view/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^unplayed/i })).not.toBeInTheDocument()
  })
})
