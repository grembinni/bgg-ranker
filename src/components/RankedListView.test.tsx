// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockReorderRankedList = vi.fn()
const mockMarkUnplayed = vi.fn()

vi.mock('../store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      ratings: { g0: 900, g1: 700 },
      games: {
        g0: { id: 'g0', name: 'Game A', yearPublished: 2020, thumbnail: '' },
        g1: { id: 'g1', name: 'Game B', yearPublished: 2021, thumbnail: '' },
      },
      reorderRankedList: mockReorderRankedList,
      markUnplayed: mockMarkUnplayed,
    }),
}))

import RankedListView from './RankedListView'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RankedListView back button removal (D-05)', () => {
  it('does not render a header element', () => {
    render(<RankedListView />)
    expect(document.querySelector('header')).not.toBeInTheDocument()
  })

  it('does not render a "Back" control', () => {
    render(<RankedListView />)
    expect(screen.queryByText(/back/i)).not.toBeInTheDocument()
  })
})
