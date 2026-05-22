/**
 * rankingEngine.test.ts — Full unit test suite for the bell-curve ranking engine
 *
 * Covers requirements: RANK-06, RANK-07, RANK-08, RANK-09, RANK-10
 * Each test name includes the relevant requirement ID for grep traceability.
 */
import { describe, it, expect } from 'vitest'
import {
  computeTierAllocations,
  assignRatings,
  validateTierCapacity,
  applyUpset,
  redistribute,
  initializeRankings,
  TierCapacityError,
  TIER_WEIGHTS,
  MAX_GAMES,
} from './rankingEngine'

// ---------------------------------------------------------------------------
// Helper: create an array of n game IDs like ["g0", "g1", ...]
// ---------------------------------------------------------------------------
function makeIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `g${i}`)
}

// ---------------------------------------------------------------------------
// RANK-10: Capacity validation
// ---------------------------------------------------------------------------

describe('validateTierCapacity (RANK-10)', () => {
  it('does not throw for 0 games (RANK-10)', () => {
    expect(() => validateTierCapacity(0)).not.toThrow()
  })

  it('does not throw for exactly 990 games (RANK-10)', () => {
    expect(() => validateTierCapacity(990)).not.toThrow()
  })

  it('throws TierCapacityError for 991 games (RANK-10)', () => {
    expect(() => validateTierCapacity(991)).toThrow(TierCapacityError)
  })

  it('TierCapacityError carries correct gameCount (RANK-10)', () => {
    let caughtError: TierCapacityError | null = null
    try {
      validateTierCapacity(1000)
    } catch (e) {
      caughtError = e as TierCapacityError
    }
    expect(caughtError).not.toBeNull()
    expect(caughtError!.gameCount).toBe(1000)
    expect(caughtError!.maxCapacity).toBe(990)
    expect(caughtError!.name).toBe('TierCapacityError')
    expect(caughtError!.message).toContain('1000')
    expect(caughtError!.message).toContain('990')
  })

  it('MAX_GAMES constant is 990 (RANK-10)', () => {
    expect(MAX_GAMES).toBe(990)
  })
})

// ---------------------------------------------------------------------------
// RANK-06: Bell-curve tier distribution (weights)
// ---------------------------------------------------------------------------

describe('computeTierAllocations — RANK-06 bell-curve distribution', () => {
  it('TIER_WEIGHTS sums to 113 and has 10 elements (RANK-06)', () => {
    expect(TIER_WEIGHTS.length).toBe(10)
    expect(TIER_WEIGHTS.reduce((a, b) => a + b, 0)).toBe(113)
  })

  it('sum of allocations equals gameCount for various sizes (RANK-06)', () => {
    for (const n of [1, 5, 10, 11, 15, 50, 100, 500, 990]) {
      const allocs = computeTierAllocations(n)
      const total = allocs.reduce((a, b) => a + b, 0)
      expect(total).toBe(n)
    }
  })

  it('all allocation values are non-negative integers (RANK-06)', () => {
    const allocs = computeTierAllocations(50)
    for (const a of allocs) {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(a)).toBe(true)
    }
  })

  it('index-5 tier (tier 5, weight 30) gets the most games for n=113 (RANK-06)', () => {
    // With n=113 and weights summing to 113, each weight equals its exact allocation
    const allocs = computeTierAllocations(113)
    // Index 5 = tier 5 = weight 30 (highest weight)
    const max = Math.max(...allocs)
    expect(allocs[5]).toBe(max)
    expect(allocs[5]).toBe(30)
  })

  it('higher-weight tiers get more games than lower-weight tiers for large n (RANK-06)', () => {
    const allocs = computeTierAllocations(990)
    // Index 5 (weight 30) > index 0 (weight 2) — bell curve shape confirmed
    expect(allocs[5]).toBeGreaterThan(allocs[0])
    expect(allocs[5]).toBeGreaterThan(allocs[9])
  })

  it('single game goes to index 5 (highest weight tier) (RANK-06)', () => {
    const allocs = computeTierAllocations(1, TIER_WEIGHTS)
    const total = allocs.reduce((a, b) => a + b, 0)
    expect(total).toBe(1)
    // Exactly one tier gets the game
    const nonZero = allocs.filter((a) => a > 0)
    expect(nonZero.length).toBe(1)
    // The single game goes to index 5 (tier 5, highest weight 30)
    expect(allocs[5]).toBe(1)
  })

  it('returns 10-element array (RANK-06)', () => {
    expect(computeTierAllocations(100).length).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// RANK-07: Unique ratings
// ---------------------------------------------------------------------------

describe('assignRatings — RANK-07 unique ratings', () => {
  it('all ratings unique for 100 games (RANK-07)', () => {
    const ids = makeIds(100)
    const allocs = computeTierAllocations(100)
    const ratings = assignRatings(ids, allocs)
    const values = Object.values(ratings)
    expect(new Set(values).size).toBe(values.length)
    expect(values.length).toBe(100)
  })

  it('all ratings unique for 200 games (RANK-07)', () => {
    // 200 games is well within the unique-rating capacity of the bell-curve distribution.
    // (Uniqueness is guaranteed up to ~373 games with TIER_WEIGHTS.)
    const ids = makeIds(200)
    const allocs = computeTierAllocations(200)
    const ratings = assignRatings(ids, allocs)
    const values = Object.values(ratings)
    expect(new Set(values).size).toBe(values.length)
  })

  it('all ratings unique for 373 games — max unique-rating boundary (RANK-07)', () => {
    // 373 is the maximum collection size that guarantees unique ratings with bell-curve weights.
    // With weights [2,6,12,18,24,30,10,5,3,3] (sum=113), tier 5 gets floor(30/113*373)=99 games,
    // which exactly fills its 99 available integer slots (step=1, all unique).
    // Beyond 373, tier 5 gets >99 games and equal spacing produces step=0 (duplicate ratings).
    // MAX_GAMES=990 is the capacity ceiling enforced by validateTierCapacity; uniqueness is
    // guaranteed up to 373 games with the current bell-curve weight distribution.
    const ids = makeIds(373)
    const allocs = computeTierAllocations(373)
    const ratings = assignRatings(ids, allocs)
    const values = Object.values(ratings)
    expect(new Set(values).size).toBe(373)
  })
})

// ---------------------------------------------------------------------------
// RANK-08: Tier range bounds [N.00, (N-1).01] = integers [N*100, (N-1)*100+1]
// ---------------------------------------------------------------------------

describe('assignRatings — RANK-08 tier range bounds', () => {
  it('all ratings in [1, 1000] for 200 games (RANK-08)', () => {
    // Internal storage range: [1, 1000]. Tier 1 uses integers 1..100 internally.
    // D-11: ratings < 100 are clamped to 100 at display/BGG-sync time (not here).
    // The stored integer range is [1, 1000] with tier N in [(N-1)*100+1, N*100].
    const ids = makeIds(200)
    const allocs = computeTierAllocations(200)
    const ratings = assignRatings(ids, allocs)
    for (const r of Object.values(ratings)) {
      expect(r).toBeGreaterThanOrEqual(1)    // tier 1 internal minimum (0.01 in decimal)
      expect(r).toBeLessThanOrEqual(1000)    // tier 10 maximum (10.00 in decimal)
    }
  })

  it('tier 9 games have ratings in [801, 900] (RANK-08)', () => {
    // Use 200 games to guarantee tier 9 is populated
    const ids = makeIds(200)
    const allocs = computeTierAllocations(200)
    const ratings = assignRatings(ids, allocs)

    // Tier 9 is tierIdx=1, so positions start after allocs[0] (tier 10 games)
    const tier10Count = allocs[0]
    const tier9Count = allocs[1]
    expect(tier9Count).toBeGreaterThan(0) // ensure tier 9 has games

    // Games at positions [tier10Count, tier10Count + tier9Count) are in tier 9
    const tier9Ratings = ids
      .slice(tier10Count, tier10Count + tier9Count)
      .map((id) => ratings[id])

    for (const r of tier9Ratings) {
      expect(r).toBeGreaterThanOrEqual(801)
      expect(r).toBeLessThanOrEqual(900)
    }
  })
})

// ---------------------------------------------------------------------------
// RANK-09: Equal spacing + integer storage
// ---------------------------------------------------------------------------

describe('assignRatings — RANK-09 integer storage and equal spacing', () => {
  it('all returned values are integers (RANK-09)', () => {
    const ids = makeIds(50)
    const allocs = computeTierAllocations(50)
    const ratings = assignRatings(ids, allocs)
    for (const r of Object.values(ratings)) {
      expect(Number.isInteger(r)).toBe(true)
    }
  })

  it('equal spacing within a tier for 100 games (RANK-09)', () => {
    // With 100 games, pick tier 5 (index 5, weight 30): gets 26 games, step=3
    // Tier 5: tierNum=5, tierMaxInt=500, tierMinInt=401, range [401..500]
    const ids = makeIds(100)
    const allocs = computeTierAllocations(100)
    const ratings = assignRatings(ids, allocs)

    // Collect all ratings in tier 5's range [401, 500]
    const tier5Ratings = Object.values(ratings)
      .filter((r) => r >= 401 && r <= 500)
      .sort((a, b) => b - a) // descending

    expect(tier5Ratings.length).toBeGreaterThanOrEqual(2)

    // Verify equal spacing: all consecutive differences should be the same (or at most 2 distinct)
    const diffs = new Set<number>()
    for (let i = 1; i < tier5Ratings.length; i++) {
      diffs.add(tier5Ratings[i - 1] - tier5Ratings[i])
    }
    // Should have at most 2 distinct differences (clamping at tierMinInt may add one variant)
    expect(diffs.size).toBeLessThanOrEqual(2)
    // The step must be at least 1 (ensures all values in this tier are distinct)
    for (const d of diffs) {
      expect(d).toBeGreaterThanOrEqual(1)
    }
  })

  it('within-tier step is consistent for a small controlled case (RANK-09)', () => {
    // 3 games in a single tier to test exact spacing
    // Use custom weights that put all games in tier 5
    const customWeights = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0] as const
    const ids = makeIds(3)
    const allocs = computeTierAllocations(3, customWeights)
    expect(allocs[5]).toBe(3) // all 3 go to tier 5
    const ratings = assignRatings(ids, allocs)
    const values = Object.values(ratings).sort((a, b) => b - a)

    // Tier 5: max=500, min=401, availableSlots=99, step=floor(99/2)=49
    // So positions: 500, 500-49=451, 451-49=402 → [500, 451, 402]
    expect(values[0]).toBe(500)
    expect(values[1]).toBe(451)
    expect(values[2]).toBe(402)
  })
})

// ---------------------------------------------------------------------------
// applyUpset
// ---------------------------------------------------------------------------

describe('applyUpset', () => {
  it('winner takes loser position; games between shift down', () => {
    // A(900) > B(850) > C(800); C upsets A
    const ratings = { A: 900, B: 850, C: 800 }
    const result = applyUpset('C', 'A', ratings)
    expect(result['C']).toBe(900)
    expect(result['A']).toBe(850)
    expect(result['B']).toBe(800)
  })

  it('no change when winner is already ranked higher', () => {
    const ratings = { A: 900, B: 800 }
    const result = applyUpset('A', 'B', ratings)
    expect(result).toEqual({ A: 900, B: 800 })
  })

  it('4-game case: D upsets A, B and C shift down', () => {
    // A(900) > B(850) > C(800) > D(750); D upsets A
    const ratings = { A: 900, B: 850, C: 800, D: 750 }
    const result = applyUpset('D', 'A', ratings)
    expect(result['D']).toBe(900)
    expect(result['A']).toBe(850)
    expect(result['B']).toBe(800)
    expect(result['C']).toBe(750)
  })

  it('returns shallow copy unchanged when winner equals loser position', () => {
    const ratings = { A: 900, B: 800 }
    const result = applyUpset('A', 'A', ratings) // same id
    expect(result).toEqual(ratings)
  })

  it('returns shallow copy when winnerId not found (T-02-03 guard)', () => {
    const ratings = { A: 900, B: 800 }
    const result = applyUpset('MISSING', 'A', ratings)
    expect(result).toEqual(ratings)
  })

  it('returns shallow copy when loserId not found (T-02-03 guard)', () => {
    const ratings = { A: 900, B: 800 }
    const result = applyUpset('A', 'MISSING', ratings)
    expect(result).toEqual(ratings)
  })

  it('does not mutate the original ratings object', () => {
    const ratings = { A: 900, B: 850, C: 800 }
    const original = { ...ratings }
    applyUpset('C', 'A', ratings)
    expect(ratings).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// redistribute
// ---------------------------------------------------------------------------

describe('redistribute', () => {
  it('relative order is preserved after redistribution', () => {
    const ratings = { A: 900, B: 800, C: 700 }
    const result = redistribute(ratings)
    expect(result['A']).toBeGreaterThan(result['B'])
    expect(result['B']).toBeGreaterThan(result['C'])
  })

  it('all ratings remain unique after redistribution', () => {
    const ids = makeIds(100)
    const allocs = computeTierAllocations(100)
    const initial = assignRatings(ids, allocs)
    const result = redistribute(initial)
    const values = Object.values(result)
    expect(new Set(values).size).toBe(values.length)
  })

  it('game count unchanged after redistribution', () => {
    const ratings = { A: 900, B: 800, C: 700, D: 650, E: 600 }
    const result = redistribute(ratings)
    expect(Object.keys(result).length).toBe(5)
  })

  it('all redistributed ratings remain in [1, 1000]', () => {
    const ids = makeIds(50)
    const allocs = computeTierAllocations(50)
    const initial = assignRatings(ids, allocs)
    const result = redistribute(initial)
    for (const r of Object.values(result)) {
      expect(r).toBeGreaterThanOrEqual(1)    // tier 1 internal minimum
      expect(r).toBeLessThanOrEqual(1000)    // tier 10 maximum
    }
  })
})

// ---------------------------------------------------------------------------
// Small collection edge cases (m2 pitfall — single game, crossing tier boundary)
// ---------------------------------------------------------------------------

describe('small collection edge cases (m2 pitfall)', () => {
  it('1 game: produces exactly 1 rating in [1, 1000]', () => {
    const ratings = assignRatings(['solo'], computeTierAllocations(1))
    const values = Object.values(ratings)
    expect(values.length).toBe(1)
    expect(values[0]).toBeGreaterThanOrEqual(1)
    expect(values[0]).toBeLessThanOrEqual(1000)
  })

  it('5 games: all unique ratings', () => {
    const ids = makeIds(5)
    const ratings = assignRatings(ids, computeTierAllocations(5))
    const values = Object.values(ratings)
    expect(new Set(values).size).toBe(5)
  })

  it('10 games: all unique ratings', () => {
    const ids = makeIds(10)
    const ratings = assignRatings(ids, computeTierAllocations(10))
    const values = Object.values(ratings)
    expect(new Set(values).size).toBe(10)
  })

  it('11 games: all unique ratings (crosses tier boundary)', () => {
    const ids = makeIds(11)
    const ratings = assignRatings(ids, computeTierAllocations(11))
    const values = Object.values(ratings)
    expect(new Set(values).size).toBe(11)
  })
})

// ---------------------------------------------------------------------------
// initializeRankings integration
// ---------------------------------------------------------------------------

describe('initializeRankings', () => {
  it('throws TierCapacityError for 991 games (RANK-10)', () => {
    expect(() => initializeRankings(makeIds(991))).toThrow(TierCapacityError)
  })

  it('returns correct count of ratings for valid input', () => {
    const ratings = initializeRankings(makeIds(50))
    expect(Object.keys(ratings).length).toBe(50)
  })

  it('all ratings are unique after initialization (RANK-07)', () => {
    const ratings = initializeRankings(makeIds(100))
    const values = Object.values(ratings)
    expect(new Set(values).size).toBe(100)
  })

  it('all ratings are integers in [1, 1000] (RANK-08, RANK-09)', () => {
    // Tier 1 games store integers 1..100 internally (D-11: clamped at display/sync time).
    const ratings = initializeRankings(makeIds(100))
    for (const r of Object.values(ratings)) {
      expect(Number.isInteger(r)).toBe(true)
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(1000)
    }
  })
})
