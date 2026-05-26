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

function makeIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `g${i}`)
}

function splitTier1(values: number[]) {
  return {
    tier1: values.filter(v => v === 100),
    upper: values.filter(v => v > 100),
  }
}

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

describe('computeTierAllocations — RANK-06 bell-curve distribution', () => {
  it('TIER_WEIGHTS sums to 100 and has 10 elements (RANK-06)', () => {
    expect(TIER_WEIGHTS.length).toBe(10)
    expect(TIER_WEIGHTS.reduce((a, b) => a + b, 0)).toBe(100)
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

  it('indices 4 and 5 (tiers 6 and 5, weight 18 each) are tied for most games at n=100 (RANK-06)', () => {
    const allocs = computeTierAllocations(100)
    const max = Math.max(...allocs)
    expect(allocs[4]).toBe(max)
    expect(allocs[5]).toBe(max)
    expect(allocs[4]).toBe(18)
    expect(allocs[5]).toBe(18)
  })

  it('higher-weight tiers get more games than lower-weight tiers for small n (RANK-06)', () => {
    const allocs = computeTierAllocations(200)
    expect(allocs[5]).toBeGreaterThan(allocs[0])
    expect(allocs[5]).toBeGreaterThan(allocs[9])
  })

  it('single game goes to index 4 or 5 (tiers 6/5 tied at weight 18) (RANK-06)', () => {
    const allocs = computeTierAllocations(1, TIER_WEIGHTS)
    const total = allocs.reduce((a, b) => a + b, 0)
    expect(total).toBe(1)
    const nonZero = allocs.filter((a) => a > 0)
    expect(nonZero.length).toBe(1)
    expect(allocs[4] + allocs[5]).toBe(1)
  })

  it('returns 10-element array (RANK-06)', () => {
    expect(computeTierAllocations(100).length).toBe(10)
  })
})

describe('assignRatings — RANK-07 unique ratings', () => {
  it('tier 1 games all get rating 100 (BGG minimum 1.00) (RANK-07)', () => {
    const customWeights = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] as const
    const ids = makeIds(5)
    const allocs = computeTierAllocations(5, customWeights)
    const ratings = assignRatings(ids, allocs)
    const values = Object.values(ratings)
    expect(values.every(v => v === 100)).toBe(true)
  })

  it('tiers 2-10 ratings are unique for 100 games; tier 1 games share 1.00 (RANK-07)', () => {
    const ids = makeIds(100)
    const allocs = computeTierAllocations(100)
    const ratings = assignRatings(ids, allocs)
    const { tier1, upper } = splitTier1(Object.values(ratings))
    expect(upper.length + tier1.length).toBe(100)
    expect(new Set(upper).size).toBe(upper.length)
    expect(tier1.every(v => v === 100)).toBe(true)
  })

  it('tiers 2-10 ratings are unique for 200 games (RANK-07)', () => {
    const ids = makeIds(200)
    const allocs = computeTierAllocations(200)
    const { upper } = splitTier1(Object.values(assignRatings(ids, allocs)))
    expect(new Set(upper).size).toBe(upper.length)
  })

  it('tiers 2-10 ratings are unique for 373 games (RANK-07)', () => {
    const ids = makeIds(373)
    const allocs = computeTierAllocations(373)
    const { upper } = splitTier1(Object.values(assignRatings(ids, allocs)))
    expect(new Set(upper).size).toBe(upper.length)
  })

  it('tiers 2-10 ratings unique for 400 games — overflow redistributed (RANK-07)', () => {
    const ids = makeIds(400)
    const allocs = computeTierAllocations(400)
    const { upper } = splitTier1(Object.values(assignRatings(ids, allocs)))
    expect(new Set(upper).size).toBe(upper.length)
  })

  it('no tier allocation exceeds 99 for any collection size up to 990 (RANK-07)', () => {
    for (const n of [374, 400, 500, 700, 990]) {
      const allocs = computeTierAllocations(n)
      for (const a of allocs) {
        expect(a).toBeLessThanOrEqual(99)
      }
    }
  })

  it('tiers 2-10 ratings unique for 990 games (RANK-07)', () => {
    const ids = makeIds(990)
    const allocs = computeTierAllocations(990)
    const { upper } = splitTier1(Object.values(assignRatings(ids, allocs)))
    expect(new Set(upper).size).toBe(upper.length)
  })
})

describe('assignRatings — RANK-08 tier range bounds', () => {
  it('all ratings in [100, 1000] for 200 games (RANK-08)', () => {
    const ids = makeIds(200)
    const allocs = computeTierAllocations(200)
    const ratings = assignRatings(ids, allocs)
    for (const r of Object.values(ratings)) {
      expect(r).toBeGreaterThanOrEqual(100)
      expect(r).toBeLessThanOrEqual(1000)
    }
  })

  it('tier 9 games have ratings in [801, 900] (RANK-08)', () => {
    const ids = makeIds(200)
    const allocs = computeTierAllocations(200)
    const ratings = assignRatings(ids, allocs)

    const tier10Count = allocs[0]
    const tier9Count = allocs[1]
    expect(tier9Count).toBeGreaterThan(0)

    const tier9Ratings = ids
      .slice(tier10Count, tier10Count + tier9Count)
      .map((id) => ratings[id])

    for (const r of tier9Ratings) {
      expect(r).toBeGreaterThanOrEqual(801)
      expect(r).toBeLessThanOrEqual(900)
    }
  })
})

describe('assignRatings — RANK-09 integer storage and equal spacing', () => {
  it('all returned values are integers (RANK-09)', () => {
    const ids = makeIds(50)
    const allocs = computeTierAllocations(50)
    const ratings = assignRatings(ids, allocs)
    for (const r of Object.values(ratings)) {
      expect(Number.isInteger(r)).toBe(true)
    }
  })

  it('consistent spacing within a tier for 100 games (RANK-09)', () => {
    // With 100 games, tier 5 (index 5, weight 21) gets 21 games → ≤40 band → endings {0,3,5,7}
    const ids = makeIds(100)
    const allocs = computeTierAllocations(100)
    const ratings = assignRatings(ids, allocs)

    const tier5Ratings = Object.values(ratings)
      .filter((r) => r >= 401 && r <= 500)
      .sort((a, b) => b - a)

    expect(tier5Ratings.length).toBeGreaterThanOrEqual(2)

    const diffs = new Set<number>()
    for (let i = 1; i < tier5Ratings.length; i++) {
      diffs.add(tier5Ratings[i - 1] - tier5Ratings[i])
    }
    expect(diffs.size).toBeLessThanOrEqual(2)
    for (const d of diffs) {
      expect(d).toBeGreaterThanOrEqual(1)
    }
  })

  it('within-tier slot selection for a small controlled case (RANK-09)', () => {
    // 3 games in tier 5 → ≤10 band → last digit 0 slots from top: 500, 490, 480
    const customWeights = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0] as const
    const ids = makeIds(3)
    const allocs = computeTierAllocations(3, customWeights)
    expect(allocs[5]).toBe(3)
    const ratings = assignRatings(ids, allocs)
    const values = Object.values(ratings).sort((a, b) => b - a)

    expect(values[0]).toBe(500)
    expect(values[1]).toBe(490)
    expect(values[2]).toBe(480)
  })
})

describe('applyUpset', () => {
  it('winner takes loser position; games between shift down', () => {
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
    const ratings = { A: 900, B: 850, C: 800, D: 750 }
    const result = applyUpset('D', 'A', ratings)
    expect(result['D']).toBe(900)
    expect(result['A']).toBe(850)
    expect(result['B']).toBe(800)
    expect(result['C']).toBe(750)
  })

  it('returns shallow copy unchanged when winner equals loser position', () => {
    const ratings = { A: 900, B: 800 }
    const result = applyUpset('A', 'A', ratings)
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
    const { upper } = splitTier1(Object.values(result))
    expect(new Set(upper).size).toBe(upper.length)
  })

  it('game count unchanged after redistribution', () => {
    const ratings = { A: 900, B: 800, C: 700, D: 650, E: 600 }
    const result = redistribute(ratings)
    expect(Object.keys(result).length).toBe(5)
  })

  it('all redistributed ratings remain in [100, 1000]', () => {
    const ids = makeIds(50)
    const allocs = computeTierAllocations(50)
    const initial = assignRatings(ids, allocs)
    const result = redistribute(initial)
    for (const r of Object.values(result)) {
      expect(r).toBeGreaterThanOrEqual(100)
      expect(r).toBeLessThanOrEqual(1000)
    }
  })
})

describe('small collection edge cases', () => {
  it('1 game: produces exactly 1 rating in [100, 1000]', () => {
    const ratings = assignRatings(['solo'], computeTierAllocations(1))
    const values = Object.values(ratings)
    expect(values.length).toBe(1)
    expect(values[0]).toBeGreaterThanOrEqual(100)
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

describe('initializeRankings', () => {
  it('throws TierCapacityError for 991 games (RANK-10)', () => {
    expect(() => initializeRankings(makeIds(991))).toThrow(TierCapacityError)
  })

  it('returns correct count of ratings for valid input', () => {
    const ratings = initializeRankings(makeIds(50))
    expect(Object.keys(ratings).length).toBe(50)
  })

  it('tiers 2-10 ratings are unique after initialization (RANK-07)', () => {
    const ratings = initializeRankings(makeIds(100))
    const { upper } = splitTier1(Object.values(ratings))
    expect(new Set(upper).size).toBe(upper.length)
  })

  it('all ratings are integers in [100, 1000] (RANK-08, RANK-09)', () => {
    const ratings = initializeRankings(makeIds(100))
    for (const r of Object.values(ratings)) {
      expect(Number.isInteger(r)).toBe(true)
      expect(r).toBeGreaterThanOrEqual(100)
      expect(r).toBeLessThanOrEqual(1000)
    }
  })
})
