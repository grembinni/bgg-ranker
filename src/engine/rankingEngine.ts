/**
 * rankingEngine.ts — Bell-Curve Ranking Engine
 *
 * Pure TypeScript module. No I/O, no DOM, no side effects (except Math.random in initializeRankings).
 *
 * All ratings stored as integers: 801 = 8.01
 * Division by 100 happens only at display time / BGG sync time (never here).
 *
 * Integer space per tier:
 *   Tier N: max = N * 100, min = (N-1) * 100 + 1 → 99 available slots
 *   Tier 1: clamped to [100, 100] — BGG range confirmation pending (D-11)
 *   Total capacity: 99 slots × 10 tiers = 990 games maximum (RANK-10)
 */

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class TierCapacityError extends Error {
  constructor(
    public readonly gameCount: number,
    public readonly maxCapacity: number
  ) {
    super(`Collection size ${gameCount} exceeds maximum ${maxCapacity} games`)
    this.name = 'TierCapacityError'
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Tier weights: index 0 = tier 10 (best, 2%), index 9 = tier 1 (worst, 3%)
 * Bell curve peaks at index 5 = tier 5 (30%)
 * Sum = 2+6+12+18+24+30+10+5+3+3 = 113 (normalized proportionally at compute time)
 */
export const TIER_WEIGHTS = [2, 6, 12, 18, 24, 30, 10, 5, 3, 3] as const

/**
 * Hard ceiling: 99 unique values × 10 tiers = 990 games (RANK-10)
 */
export const MAX_GAMES = 990

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Throws TierCapacityError if collection exceeds 990 games.
 * Must be called before every initializeRankings call (D-12).
 */
export function validateTierCapacity(count: number): void {
  if (count > MAX_GAMES) {
    throw new TierCapacityError(count, MAX_GAMES)
  }
}

// ---------------------------------------------------------------------------
// Tier allocation
// ---------------------------------------------------------------------------

/**
 * Distribute gameCount across 10 tiers using the largest-remainder method.
 * Guarantees: sum of returned array === gameCount, all values are non-negative integers.
 *
 * @param gameCount - Total number of games to distribute
 * @param weights   - Relative weights per tier (default: TIER_WEIGHTS)
 * @returns 10-element array, index 0 = tier 10, index 9 = tier 1
 */
export function computeTierAllocations(
  gameCount: number,
  weights: readonly number[] = TIER_WEIGHTS
): number[] {
  const total = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (w / total) * gameCount)
  const floored = exact.map(Math.floor)
  const remainders = exact.map((v, i) => ({ idx: i, rem: v - floored[i] }))
  const deficit = gameCount - floored.reduce((a, b) => a + b, 0)

  remainders
    .sort((a, b) => b.rem - a.rem)
    .slice(0, deficit)
    .forEach(({ idx }) => floored[idx]++)

  return floored
}

// ---------------------------------------------------------------------------
// Rating assignment
// ---------------------------------------------------------------------------

/**
 * Assign integer ratings to ordered game IDs across tiers.
 *
 * Iterates tierIdx 0..9 (tier 10 first, tier 1 last).
 * Within each tier, games are equally spaced from tierMaxInt down to tierMinInt.
 * All values are integers — no floating-point arithmetic.
 *
 * @param orderedGameIds - Games ordered from best to worst (tier 10 → tier 1)
 * @param allocations    - 10-element array from computeTierAllocations
 * @returns Record mapping gameId → integer rating in [1, 1000]
 *   (tier 1 games may have values 1..100; values < 100 are clamped to 100 at display/BGG-sync time per D-11)
 */
export function assignRatings(
  orderedGameIds: string[],
  allocations: number[]
): Record<string, number> {
  const ratings: Record<string, number> = {}
  let gameIdx = 0

  for (let tierIdx = 0; tierIdx < 10; tierIdx++) {
    const tierNum = 10 - tierIdx // tier 10 first, tier 1 last
    const count = allocations[tierIdx]
    if (count === 0) {
      continue
    }

    const tierMaxInt = tierNum * 100 // 1000 for tier 10, 900 for tier 9, …
    // Each tier has a natural range of 99 integer slots:
    //   Tier N: [N*100 .. (N-1)*100+1] = N*100, N*100-1, ..., (N-1)*100+1 (99 values)
    // Tier 1 natural minimum = 1 (i.e. 0.01 in decimal).
    // D-11: values below 100 (1.00) are only clamped at DISPLAY/BGG-SYNC time, not stored here.
    // Storing internal values down to integer 1 allows tier 1 to hold up to 99 unique games.
    const tierMinInt = (tierNum - 1) * 100 + 1 // tier 1=1, tier 2=101, tier 9=801, tier 10=901

    const availableSlots = tierMaxInt - tierMinInt // 99 for all tiers

    for (let pos = 0; pos < count; pos++) {
      let rating: number
      if (count === 1) {
        // Single game in tier — assign the tier maximum
        rating = tierMaxInt
      } else {
        // Equal spacing: step = floor(availableSlots / (count - 1))
        const step = Math.floor(availableSlots / (count - 1))
        rating = tierMaxInt - pos * step
        // Clamp to tier minimum in case rounding pushes below
        if (rating < tierMinInt) {
          rating = tierMinInt
        }
      }
      ratings[orderedGameIds[gameIdx++]] = rating
    }
  }

  return ratings
}

// ---------------------------------------------------------------------------
// Upset handling
// ---------------------------------------------------------------------------

/**
 * Apply an upset: winner takes loser's rating position; games between shift down one step.
 * O(k) where k = loserPos - winnerPos.
 *
 * If winner is already ranked higher than (or equal to) loser, returns a shallow copy unchanged.
 * If either winnerId or loserId is not found in ratings, returns a shallow copy unchanged (T-02-03).
 *
 * @param winnerId - The game that won the comparison
 * @param loserId  - The game that lost the comparison
 * @param ratings  - Current ratings Record (gameId → integer rating)
 * @returns New ratings Record with upset applied
 */
export function applyUpset(
  winnerId: string,
  loserId: string,
  ratings: Record<string, number>
): Record<string, number> {
  // Sort all games by rating descending (position 0 = highest-rated)
  const ranked = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  const winnerPos = ranked.findIndex(([id]) => id === winnerId)
  const loserPos = ranked.findIndex(([id]) => id === loserId)

  // Guard: missing IDs or winner already ranked higher → no change (T-02-03)
  if (winnerPos === -1 || loserPos === -1 || winnerPos <= loserPos) {
    return { ...ratings }
  }

  const targetRating = ranked[loserPos][1]
  const result = { ...ratings }

  // Shift games between loser and winner DOWN by one position (O(k)):
  // Each game at position i takes the rating of the game at position i+1 (one below it).
  // This frees up the loser's slot for the winner.
  for (let i = loserPos; i < winnerPos; i++) {
    result[ranked[i][0]] = ranked[i + 1][1]
  }
  result[winnerId] = targetRating

  return result
}

// ---------------------------------------------------------------------------
// Redistribution
// ---------------------------------------------------------------------------

/**
 * Full redistribution: preserve relative order, recompute equal spacing for current size.
 * O(n) — only called on explicit user Refresh (REFRESH-01).
 *
 * @param ratings - Current ratings Record
 * @param weights - Tier weights (default: TIER_WEIGHTS)
 * @returns New ratings Record with all ratings recomputed
 */
export function redistribute(
  ratings: Record<string, number>,
  weights: readonly number[] = TIER_WEIGHTS
): Record<string, number> {
  // Preserve relative order (descending by current rating)
  const ordered = Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  const allocations = computeTierAllocations(ordered.length, weights)
  return assignRatings(ordered, allocations)
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize rankings for a fresh collection.
 * Validates capacity, shuffles games randomly, allocates to tiers, assigns integer ratings.
 *
 * @param gameIds - Array of game IDs to rank
 * @param weights - Tier weights (default: TIER_WEIGHTS)
 * @returns Record mapping gameId → integer rating in [100, 1000]
 * @throws TierCapacityError if gameIds.length > 990
 */
export function initializeRankings(
  gameIds: string[],
  weights: readonly number[] = TIER_WEIGHTS,
  sorted = false
): Record<string, number> {
  validateTierCapacity(gameIds.length)
  // When sorted=true the caller has pre-ordered gameIds (best→worst); skip the shuffle.
  const ordered = sorted ? [...gameIds] : [...gameIds].sort(() => Math.random() - 0.5)
  const allocations = computeTierAllocations(ordered.length, weights)
  return assignRatings(ordered, allocations)
}
