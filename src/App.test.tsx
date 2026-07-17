// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

let mockView = 'comparison'

vi.mock('./store/store', () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      view: mockView,
      dirtyGameIds: [],
    }),
}))

vi.mock('./components/Header', () => ({ default: () => <div data-testid="header" /> }))
vi.mock('./components/UsernameEntry', () => ({ default: () => <div data-testid="entry" /> }))
vi.mock('./components/CollectionLoading', () => ({ default: () => <div data-testid="loading" /> }))
vi.mock('./components/ComparisonView', () => ({ default: () => <div data-testid="comparison" /> }))
vi.mock('./components/ErrorDisplay', () => ({ default: () => <div data-testid="error" /> }))
vi.mock('./components/SyncingView', () => ({ default: () => <div data-testid="syncing" /> }))
vi.mock('./components/RankedListView', () => ({ default: () => <div data-testid="ranked-list" /> }))
vi.mock('./components/UnplayedListView', () => ({ default: () => <div data-testid="unplayed-list" /> }))
vi.mock('./components/RankedGridView', () => ({ default: () => <div data-testid="ranked-grid" /> }))

import App from './App'

beforeEach(() => {
  vi.clearAllMocks()
  mockView = 'comparison'
})

describe('App header gating (D-01, D-04)', () => {
  it.each(['comparison', 'ranked-list', 'ranked-grid', 'unplayed-list'])(
    'renders Header when view is %s',
    (view) => {
      mockView = view
      render(<App />)
      expect(screen.getByTestId('header')).toBeInTheDocument()
    }
  )

  it.each(['entry', 'loading', 'error', 'syncing'])(
    'does NOT render Header when view is %s',
    (view) => {
      mockView = view
      render(<App />)
      expect(screen.queryByTestId('header')).not.toBeInTheDocument()
    }
  )
})
